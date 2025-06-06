// TherapistConnectTherapistExpo/App.js - Updated with better Firebase handling
import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { Provider } from "react-redux";
import { store } from "./src/store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ZegoCallScreen from "./src/screens/ZegoCallScreen";
import {
  View,
  ActivityIndicator,
  StyleSheet,
  Alert,
  AppState,
} from "react-native";
import { FirebaseService } from "./src/services/firebase";

import TherapistLoginScreen from "./src/screens/TherapistLoginScreen";
import TherapistDashboard from "./src/screens/TherapistDashboard";
import CallScreen from "./src/screens/CallScreen";

import {
  setAuth,
  logout,
  setFCMToken as setReduxFCMToken,
} from "./src/store/authSlice";
import api from "./src/services/api";

const Stack = createStackNavigator();

function AppNavigator() {
  const [isLoading, setIsLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState("TherapistLogin");

  useEffect(() => {
    let appStateSubscription;
    let notificationListenerUnsubscribe;

    const init = async () => {
      try {
        // Add a small delay to ensure proper initialization
        await new Promise((resolve) => setTimeout(resolve, 500));

        console.log("Starting Firebase initialization...");
        const fcmToken = await FirebaseService.initializeFirebase();
        console.log("Therapist App FCM Token:", fcmToken);

        if (fcmToken) {
          store.dispatch(setReduxFCMToken(fcmToken));
          notificationListenerUnsubscribe =
            FirebaseService.setupNotificationListeners(handleCallNotification);
        } else {
          console.warn("FCM token not available, notifications may not work");
        }

        await checkAuthState(fcmToken);
      } catch (error) {
        console.error("Therapist App initialization error:", error);
        // Continue with app initialization even if Firebase fails
        await checkAuthState(null);
      } finally {
        setIsLoading(false);
      }
    };

    init();

    appStateSubscription = AppState.addEventListener(
      "change",
      (nextAppState) => {
        if (nextAppState === "active") {
          console.log("Therapist App has come to the foreground");
          // Only try to refresh FCM token if Firebase is available
          if (FirebaseService.isFirebaseAvailable()) {
            FirebaseService.getFCMToken()
              .then((token) => {
                if (token) {
                  store.dispatch(setReduxFCMToken(token));
                }
              })
              .catch((error) => {
                console.warn("Failed to refresh FCM token:", error);
              });
          }
        }
      }
    );

    return () => {
      appStateSubscription?.remove();
      notificationListenerUnsubscribe?.();
    };
  }, []);

  const handleCallNotification = (notificationData) => {
    console.log(
      "Therapist App - App level notification received:",
      notificationData
    );
  };

  const checkAuthState = async (fcmToken) => {
    setIsLoading(true);
    try {
      console.log("Therapist App: Checking authentication state...");
      const storedToken = await AsyncStorage.getItem("token");
      const storedUserType = await AsyncStorage.getItem("userType");

      if (storedToken && storedUserType === "therapist") {
        console.log("Therapist App: Found stored therapist credentials.");
        api.defaults.headers.common["Authorization"] = `Bearer ${storedToken}`;

        try {
          const profileResponse = await api.get("/therapist/profile");
          const therapistProfile = profileResponse.data.therapist;

          // Update FCM token on server if available
          if (fcmToken && therapistProfile._id) {
            try {
              await api.post("/auth/update-fcm-token", {
                fcmToken,
                userType: "therapist",
                userId: therapistProfile._id,
              });
              console.log(
                "Therapist App: FCM token updated for therapist ID:",
                therapistProfile._id
              );
            } catch (fcmError) {
              console.warn("Failed to update FCM token on server:", fcmError);
              // Don't fail auth because of FCM token update failure
            }
          }

          store.dispatch(
            setAuth({
              token: storedToken,
              userType: "therapist",
              therapist: {
                id: therapistProfile._id,
                name: therapistProfile.name,
                email: therapistProfile.email,
                isAvailable: therapistProfile.isAvailable,
                totalEarningsCoins: therapistProfile.totalEarningsCoins,
              },
            })
          );
          setInitialRoute("TherapistDashboard");
        } catch (error) {
          console.log(
            "Therapist App: Token validation or profile fetch failed",
            error.response?.data || error.message
          );
          await store.dispatch(logout());
          api.defaults.headers.common["Authorization"] = null;
          setInitialRoute("TherapistLogin");
        }
      } else {
        console.log(
          "Therapist App: No stored therapist credentials found or type mismatch."
        );
        if (storedToken || storedUserType) await store.dispatch(logout());
        api.defaults.headers.common["Authorization"] = null;
        setInitialRoute("TherapistLogin");
      }
    } catch (error) {
      console.error("Therapist App: Error checking auth state:", error);
      await store.dispatch(logout());
      api.defaults.headers.common["Authorization"] = null;
      setInitialRoute("TherapistLogin");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{
          headerStyle: { backgroundColor: "#4A90E2" },
          headerTintColor: "#fff",
          headerTitleStyle: { fontWeight: "bold" },
        }}
      >
        <Stack.Screen
          name="TherapistLogin"
          component={TherapistLoginScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="TherapistDashboard"
          component={TherapistDashboard}
          options={{ headerShown: false }}
        />
        <Stack.Screen name="ZegoCallScreen" component={ZegoCallScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <AppNavigator />
    </Provider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
});

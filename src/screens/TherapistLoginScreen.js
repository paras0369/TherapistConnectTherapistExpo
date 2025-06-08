// src/screens/TherapistLoginScreen.js (FOR THERAPIST APP - Patient Button Removed)
import React, { useState, useEffect } from "react"; // useEffect added for FCM
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  StatusBar,
  Dimensions,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { therapistLogin } from "../store/authSlice"; // Assuming path is correct
// Assuming path is correct
import LinearGradient from "react-native-linear-gradient";

const { width, height } = Dimensions.get("window");

export default function TherapistLoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fcmToken, setFcmToken] = useState(null); // Added for FCM
  const dispatch = useDispatch();
  const { loading } = useSelector((state) => state.auth);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter email and password");
      return;
    }

    try {
      const result = await dispatch(
        therapistLogin({ email, password, fcmToken }) // Pass fcmToken here
      ).unwrap();
      console.log("Therapist Login successful:", result);

      if (result) {
        navigation.reset({
          index: 0,
          routes: [{ name: "TherapistDashboard" }],
        });
      }
    } catch (error) {
      console.error("Therapist Login error:", error);
      Alert.alert(
        "Error",
        error.message || "Invalid credentials. Please try again."
      );
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#667eea" />
      <LinearGradient colors={["#667eea", "#764ba2"]} style={styles.gradient}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View style={styles.logo}>
              <Text style={styles.logoIcon}>👨‍⚕️</Text>
            </View>
            <Text style={styles.title}>Therapist Portal</Text>
            <Text style={styles.subtitle}>
              Welcome back to your professional dashboard
            </Text>
          </View>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.card}>
            <Text style={styles.formTitle}>Professional Login</Text>
            <Text style={styles.formSubtitle}>
              Enter your credentials to continue
            </Text>

            <View style={styles.inputContainer}>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="Email Address"
                  placeholderTextColor="#999"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#999"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              <LinearGradient
                colors={loading ? ["#ccc", "#ccc"] : ["#667eea", "#764ba2"]}
                style={styles.buttonGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.buttonText}>Login</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
            {/* REMOVED PATIENT LOGIN BUTTON AND DIVIDER */}
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By continuing, you agree to our Terms & Privacy Policy
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}

// Styles (copied from your provided TherapistLoginScreen.js, remove styles for patient button)
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  header: {
    flex: 0.4,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },
  logoContainer: {
    alignItems: "center",
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  logoIcon: {
    fontSize: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.8)",
    textAlign: "center",
    lineHeight: 22,
  },
  formContainer: {
    flex: 0.6,
    paddingHorizontal: 20,
    justifyContent: "center", // Center the card
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 30,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 30,
  },
  inputContainer: {
    marginBottom: 25,
  },
  inputWrapper: {
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 55,
    borderWidth: 1,
    borderColor: "#e9ecef",
    marginBottom: 15,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#333",
    height: "100%",
  },
  button: {
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 20,
  },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  // Removed divider and patientButton styles
  footer: {
    paddingHorizontal: 30,
    paddingBottom: 30,
    alignItems: "center",
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  footerText: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.7)",
    textAlign: "center",
    lineHeight: 18,
  },
});

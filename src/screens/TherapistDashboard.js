// src/screens/TherapistDashboard.js
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  StatusBar,
  FlatList,
  ScrollView,
  Dimensions,
  RefreshControl,
} from "react-native";
import { useSelector, useDispatch } from "react-redux";
import { useFocusEffect } from "@react-navigation/native";
import {
  logout,
  updateTherapistEarnings,
  updateTherapistAvailability,
} from "../store/authSlice";
import api from "../services/api";
import socketService from "../services/socket";
import { FirebaseService } from "../services/firebase";
import LinearGradient from "react-native-linear-gradient";

const { width } = Dimensions.get("window");

export default function TherapistDashboard({ navigation }) {
  const [isAvailable, setIsAvailable] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [showCallModal, setShowCallModal] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [callHistory, setCallHistory] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [todayStats, setTodayStats] = useState({
    callsToday: 0,
    earningsToday: 0,
    hoursToday: 0,
  });
  const [weeklyStats, setWeeklyStats] = useState({
    callsWeek: 0,
    earningsWeek: 0,
    hoursWeek: 0,
  });
  const { therapist } = useSelector((state) => state.auth);
  const dispatch = useDispatch();

  // Initialize Firebase and notification listeners
  useEffect(() => {
    if (therapist) {
      initializeFirebaseForTherapist();
    }
  }, [therapist]);

  const initializeFirebaseForTherapist = async () => {
    try {
      // Get FCM token and update on server
      const fcmToken = await FirebaseService.getFCMToken();
      if (fcmToken) {
        await api.post("/auth/update-fcm-token", {
          fcmToken,
          userType: "therapist",
          userId: therapist.id,
        });
        console.log("Therapist FCM token updated");
      }

      // Setup notification listeners for calls
      FirebaseService.setupNotificationListeners(
        handleFirebaseCallNotification
      );

      // Subscribe to therapist-specific topic
      await FirebaseService.subscribeToTopic(`therapist_${therapist.id}`);
    } catch (error) {
      console.error("Firebase initialization error for therapist:", error);
    }
  };

  const handleFirebaseCallNotification = (notificationData) => {
    console.log("Firebase call notification received:", notificationData);

    if (notificationData.type === "incoming_call") {
      // Show incoming call modal
      setIncomingCall({
        userId: notificationData.userId,
        userName: notificationData.userName,
        roomId: notificationData.roomId,
        callId: notificationData.callId,
      });
      setShowCallModal(true);
    }
  };

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log("Therapist dashboard focused, refreshing data...");
      fetchAllData();
    }, [])
  );

  useEffect(() => {
    if (therapist) {
      setIsAvailable(therapist.isAvailable);
      fetchAllData();

      // Connect socket
      const socket = socketService.connect();

      // FIXED: Properly connect therapist with their ID
      console.log("🔗 Connecting therapist to socket:", therapist.id);
      socketService.emit("therapist-connect", {
        therapistId: therapist.id,
        therapistInfo: {
          name: therapist.name,
          email: therapist.email,
          isAvailable: therapist.isAvailable,
        },
      });

      // Listen for connection confirmation
      socketService.on("connection-confirmed", (data) => {
        console.log("✅ Therapist socket connection confirmed:", data);
      });

      // Listen for incoming calls (backup to Firebase)
      socketService.on("incoming-call", (data) => {
        console.log("📞 Socket incoming call received:", data);
        setIncomingCall(data);
        setShowCallModal(true);
      });

      // Debug connection
      socketService.emit("debug-connections");
      socketService.on("debug-info", (data) => {
        console.log("🔍 Therapist debug info:", data);
      });

      // Auto-refresh stats every 60 seconds when on dashboard tab
      const autoRefreshInterval = setInterval(() => {
        if (activeTab === "dashboard") {
          fetchStats(false); // Silent refresh
        }
      }, 60000);

      return () => {
        socketService.off("incoming-call");
        socketService.off("connection-confirmed");
        socketService.off("debug-info");
        socketService.disconnect();
        clearInterval(autoRefreshInterval);
      };
    }
  }, [therapist]);

  const fetchAllData = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchCallHistory(false),
        fetchStats(false),
        fetchTherapistProfile(),
      ]);
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const fetchCallHistory = async (showLoading = true) => {
    try {
      const response = await api.get("/therapist/call-history");
      setCallHistory(response.data.calls || []);
    } catch (error) {
      console.error("Error fetching call history:", error);
    }
  };

  const fetchStats = async (showLoading = true) => {
    try {
      const response = await api.get("/therapist/stats");
      setTodayStats(response.data.today || {});
      setWeeklyStats(response.data.week || {});
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchTherapistProfile = async () => {
    try {
      const response = await api.get("/therapist/profile");
      const updatedTherapist = response.data.therapist;
      // Update therapist data in Redux store
      dispatch(updateTherapistEarnings(updatedTherapist.totalEarningsCoins));
      dispatch(updateTherapistAvailability(updatedTherapist.isAvailable));
      setIsAvailable(updatedTherapist.isAvailable);
    } catch (error) {
      console.error("Error fetching therapist profile:", error);
    }
  };

  const toggleAvailability = async () => {
    try {
      const response = await api.put("/therapist/availability", {
        isAvailable: !isAvailable,
      });
      setIsAvailable(response.data.therapist.isAvailable);
      dispatch(
        updateTherapistAvailability(response.data.therapist.isAvailable)
      );
    } catch (error) {
      Alert.alert("Error", "Failed to update availability");
    }
  };

  const onRefresh = useCallback(() => {
    fetchAllData();
  }, []);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === "history") {
      fetchCallHistory(false);
    } else if (tab === "dashboard") {
      fetchStats(false);
    }
  };

  // src/screens/TherapistDashboard.js - Fixed acceptCall function

  const acceptCall = async () => {
    setShowCallModal(false);
    try {
      console.log("Accepting call:", incomingCall);

      let callId = incomingCall.callId;

      // If callId is not provided, extract from roomId
      if (!callId && incomingCall.roomId) {
        callId = incomingCall.roomId.split("-")[1];
      }

      // Update call status on server first
      if (callId) {
        try {
          await api.post(`/call/answer/${callId}`);
          console.log("Call answered on server");
        } catch (apiError) {
          console.warn("Failed to update call status on server:", apiError);
          // Continue anyway - the call might still work
        }
      }

      // Join the room BEFORE sending acceptance notification
      console.log("Joining room:", incomingCall.roomId);
      socketService.emit("join-room", incomingCall.roomId);

      // Send call acceptance notification to user
      console.log("Sending call-accepted event to user:", incomingCall.userId);
      socketService.emit("call-accepted", {
        userId: incomingCall.userId,
        therapistId: therapist.id,
        roomId: incomingCall.roomId,
        callId: callId,
      });

      console.log("Navigating to call screen");

      // Navigate to call screen
      navigation.navigate("Call", {
        roomId: incomingCall.roomId,
        userId: incomingCall.userId,
        isInitiator: false, // Therapist is not the initiator
      });

      // Clear incoming call state
      setIncomingCall(null);
    } catch (error) {
      console.error("Error accepting call:", error);
      Alert.alert("Error", "Failed to accept call");
      setIncomingCall(null);
    }
  };

  const rejectCall = () => {
    setShowCallModal(false);
    socketService.emit("call-rejected", {
      userId: incomingCall.userId,
      therapistId: therapist.id,
    });
    setIncomingCall(null);
  };

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            // Unsubscribe from Firebase topics
            await FirebaseService.unsubscribeFromTopic(
              `therapist_${therapist.id}`
            );
          } catch (error) {
            console.error("Error unsubscribing from Firebase topics:", error);
          }

          dispatch(logout());
          navigation.reset({
            index: 0,
            routes: [{ name: "TherapistLogin" }],
          });
        },
      },
    ]);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return (
      date.toLocaleDateString() +
      " " +
      date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  };

  const formatDuration = (minutes) => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  };

  const StatCard = ({ title, value, subtitle, icon, color }) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={styles.statHeader}>
        <Text style={styles.statIcon}>{icon}</Text>
        <Text style={styles.statTitle}>{title}</Text>
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statSubtitle}>{subtitle}</Text>
    </View>
  );

  const renderCallHistoryItem = ({ item }) => (
    <View style={styles.historyCard}>
      <View style={styles.historyHeader}>
        <View style={styles.historyAvatar}>
          <Text style={styles.historyAvatarText}>U</Text>
        </View>
        <View style={styles.historyInfo}>
          <Text style={styles.historyUserName}>
            User ({item.userId?.phoneNumber?.slice(-4) || "Unknown"})
          </Text>
          <Text style={styles.historyDate}>{formatDate(item.startTime)}</Text>
        </View>
        <View style={styles.historyMeta}>
          <Text style={styles.historyDuration}>
            {formatDuration(item.durationMinutes)}
          </Text>
          <Text style={styles.historyEarnings}>
            +{item.therapistEarningsCoins} coins
          </Text>
        </View>
      </View>
      <View style={styles.historyStatus}>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(item.status) },
          ]}
        >
          <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
        </View>
      </View>
    </View>
  );

  const getStatusColor = (status) => {
    switch (status) {
      case "ended_by_user":
      case "ended_by_therapist":
        return "#4CAF50";
      case "missed":
        return "#f44336";
      case "rejected":
        return "#ff9800";
      default:
        return "#9e9e9e";
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case "ended_by_user":
      case "ended_by_therapist":
        return "Completed";
      case "missed":
        return "Missed";
      case "rejected":
        return "Rejected";
      default:
        return "Unknown";
    }
  };

  const DashboardContent = () => (
    <ScrollView
      style={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={["#667eea"]}
          tintColor={"#667eea"}
        />
      }
    >
      {/* Availability Toggle */}
      <View style={styles.availabilityCard}>
        <LinearGradient
          colors={isAvailable ? ["#4CAF50", "#45a049"] : ["#f44336", "#da190b"]}
          style={styles.availabilityGradient}
        >
          <View style={styles.availabilityContent}>
            <View style={styles.availabilityLeft}>
              <Text style={styles.availabilityIcon}>
                {isAvailable ? "🟢" : "🔴"}
              </Text>
              <View>
                <Text style={styles.availabilityTitle}>
                  {isAvailable ? "Available" : "Unavailable"}
                </Text>
                <Text style={styles.availabilitySubtitle}>
                  {isAvailable
                    ? "You can receive calls from users"
                    : "You are not visible to users"}
                </Text>
              </View>
            </View>
            <Switch
              value={isAvailable}
              onValueChange={toggleAvailability}
              trackColor={{ false: "#767577", true: "rgba(255,255,255,0.3)" }}
              thumbColor="#fff"
            />
          </View>
        </LinearGradient>
      </View>

      {/* Today's Stats */}
      <Text style={styles.sectionTitle}>📊 Today's Performance</Text>
      <View style={styles.statsRow}>
        <StatCard
          title="Calls"
          value={todayStats.callsToday || 0}
          subtitle="sessions today"
          icon="📞"
          color="#4CAF50"
        />
        <StatCard
          title="Earnings"
          value={`${todayStats.earningsToday || 0}`}
          subtitle="coins earned"
          icon="💰"
          color="#FF9800"
        />
      </View>

      <View style={styles.statsRow}>
        <StatCard
          title="Hours"
          value={formatDuration(todayStats.minutesToday || 0)}
          subtitle="time spent"
          icon="⏰"
          color="#2196F3"
        />
        <StatCard
          title="Total"
          value={`${therapist?.totalEarningsCoins || 0}`}
          subtitle="lifetime coins"
          icon="🏆"
          color="#9C27B0"
        />
      </View>

      {/* Weekly Stats */}
      <Text style={styles.sectionTitle}>📈 This Week</Text>
      <View style={styles.weeklyCard}>
        <View style={styles.weeklyItem}>
          <Text style={styles.weeklyLabel}>Calls</Text>
          <Text style={styles.weeklyValue}>{weeklyStats.callsWeek || 0}</Text>
        </View>
        <View style={styles.weeklyDivider} />
        <View style={styles.weeklyItem}>
          <Text style={styles.weeklyLabel}>Earnings</Text>
          <Text style={styles.weeklyValue}>
            {weeklyStats.earningsWeek || 0} coins
          </Text>
        </View>
        <View style={styles.weeklyDivider} />
        <View style={styles.weeklyItem}>
          <Text style={styles.weeklyLabel}>Hours</Text>
          <Text style={styles.weeklyValue}>
            {formatDuration(weeklyStats.minutesWeek || 0)}
          </Text>
        </View>
      </View>
    </ScrollView>
  );

  const CallHistoryContent = () => (
    <FlatList
      data={callHistory}
      renderItem={renderCallHistoryItem}
      keyExtractor={(item) => item._id}
      contentContainerStyle={styles.listContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={["#667eea"]}
          tintColor={"#667eea"}
        />
      }
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>No call history</Text>
          <Text style={styles.emptySubtext}>
            Your completed sessions will appear here
          </Text>
        </View>
      }
    />
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#667eea" />

      {/* Header */}
      <LinearGradient colors={["#667eea", "#764ba2"]} style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.therapistAvatar}>
            <Text style={styles.therapistAvatarText}>
              {therapist?.name?.charAt(0) || "T"}
            </Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.welcomeText}>Dr. {therapist?.name}</Text>
            <View style={styles.earningsContainer}>
              <Text style={styles.earningsIcon}>💰</Text>
              <Text style={styles.earningsText}>
                {therapist?.totalEarningsCoins || 0} coins
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutIcon}>🚪</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "dashboard" && styles.activeTab]}
          onPress={() => handleTabChange("dashboard")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "dashboard" && styles.activeTabText,
            ]}
          >
            📊 Dashboard
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "history" && styles.activeTab]}
          onPress={() => handleTabChange("history")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "history" && styles.activeTabText,
            ]}
          >
            📋 History
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === "dashboard" ? (
        <DashboardContent />
      ) : (
        <CallHistoryContent />
      )}

      {/* Incoming Call Modal */}
      <Modal
        visible={showCallModal}
        transparent
        animationType="slide"
        onRequestClose={rejectCall}
      >
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={["#4CAF50", "#45a049"]}
            style={styles.callModalContent}
          >
            <View style={styles.callModalHeader}>
              <Text style={styles.callModalTitle}>📞 Incoming Call</Text>
              <Text style={styles.callModalSubtitle}>
                {incomingCall?.userName || "User"} is calling...
              </Text>
            </View>

            <View style={styles.callerInfo}>
              <View style={styles.callerAvatar}>
                <Text style={styles.callerAvatarText}>U</Text>
              </View>
              <Text style={styles.callerName}>
                {incomingCall?.userName || "User"}
              </Text>
              <Text style={styles.roomInfo}>Room: {incomingCall?.roomId}</Text>
            </View>

            <View style={styles.callActions}>
              <TouchableOpacity
                style={styles.rejectButton}
                onPress={rejectCall}
              >
                <Text style={styles.rejectIcon}>📞</Text>
                <Text style={styles.rejectText}>Decline</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.acceptButton}
                onPress={acceptCall}
              >
                <Text style={styles.acceptIcon}>📞</Text>
                <Text style={styles.acceptText}>Accept</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    paddingTop: StatusBar.currentHeight + 10,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  therapistAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  therapistAvatarText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  headerInfo: {
    flex: 1,
    marginLeft: 15,
  },
  welcomeText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  earningsContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  earningsIcon: {
    fontSize: 16,
    marginRight: 5,
  },
  earningsText: {
    color: "#fff",
    fontSize: 14,
  },
  logoutButton: {
    padding: 10,
  },
  logoutIcon: {
    fontSize: 20,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginTop: -10,
    borderRadius: 15,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: "center",
    borderRadius: 15,
  },
  activeTab: {
    backgroundColor: "#667eea",
  },
  tabText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "600",
  },
  activeTabText: {
    color: "#fff",
  },
  content: {
    flex: 1,
    marginTop: 20,
  },
  availabilityCard: {
    marginHorizontal: 20,
    marginBottom: 25,
    borderRadius: 15,
    overflow: "hidden",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  availabilityGradient: {
    padding: 20,
  },
  availabilityContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  availabilityLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  availabilityIcon: {
    fontSize: 24,
    marginRight: 15,
  },
  availabilityTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
  },
  availabilitySubtitle: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginHorizontal: 20,
    marginBottom: 15,
  },
  statsRow: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginBottom: 15,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
    marginHorizontal: 5,
    borderLeftWidth: 4,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  statHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  statIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  statTitle: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 5,
  },
  statSubtitle: {
    fontSize: 12,
    color: "#999",
  },
  weeklyCard: {
    backgroundColor: "#fff",
    marginHorizontal: 20,
    borderRadius: 15,
    padding: 20,
    flexDirection: "row",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    marginBottom: 20,
  },
  weeklyItem: {
    flex: 1,
    alignItems: "center",
  },
  weeklyLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  weeklyValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  weeklyDivider: {
    width: 1,
    backgroundColor: "#e9ecef",
    marginHorizontal: 15,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  historyCard: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  historyAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#667eea",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  historyAvatarText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  historyInfo: {
    flex: 1,
  },
  historyUserName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  historyDate: {
    fontSize: 12,
    color: "#666",
  },
  historyMeta: {
    alignItems: "flex-end",
  },
  historyDuration: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  historyEarnings: {
    fontSize: 12,
    color: "#4CAF50",
    fontWeight: "500",
  },
  historyStatus: {
    alignItems: "flex-start",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 15,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  callModalContent: {
    width: width * 0.85,
    borderRadius: 25,
    padding: 30,
    alignItems: "center",
  },
  callModalHeader: {
    alignItems: "center",
    marginBottom: 30,
  },
  callModalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  callModalSubtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.8)",
  },
  callerInfo: {
    alignItems: "center",
    marginBottom: 40,
  },
  callerAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  callerAvatarText: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "bold",
  },
  callerName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 5,
  },
  roomInfo: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.6)",
  },
  callActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
  },
  rejectButton: {
    backgroundColor: "#f44336",
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: "center",
    minWidth: 100,
  },
  acceptButton: {
    backgroundColor: "#fff",
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: "center",
    minWidth: 100,
  },
  rejectIcon: {
    fontSize: 20,
    marginBottom: 5,
    transform: [{ rotate: "135deg" }],
  },
  acceptIcon: {
    fontSize: 20,
    marginBottom: 5,
  },
  rejectText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  acceptText: {
    color: "#4CAF50",
    fontWeight: "bold",
    fontSize: 14,
  },
});

// src/screens/TherapistDashboard.js - Fixed implementation
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
import unifiedZegoService from "../services/unifiedZegoService";

import socketService from "../services/socket";
import {
  CALL_TYPES,
  CALL_PRICING,
  validateZegoConfig,
} from "../config/zegoConfig";
import LinearGradient from "react-native-linear-gradient";

const { width } = Dimensions.get("window");

export default function TherapistDashboard({ navigation }) {
  const [isAvailable, setIsAvailable] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [showCallModal, setShowCallModal] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [callHistory, setCallHistory] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [zegoConfigValid, setZegoConfigValid] = useState(false);
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

  // Check ZegoCloud configuration on mount
  useEffect(() => {
    const config = validateZegoConfig();
    setZegoConfigValid(config.isValid);

    if (!config.isValid) {
      console.warn("ZegoCloud configuration issues:", config.errors);
      Alert.alert(
        "Configuration Error",
        "Call functionality requires proper ZegoCloud setup. Please contact support.",
        [{ text: "OK" }]
      );
    }
  }, []);
  useEffect(() => {
    if (therapist) {
      // Initialize socket connection
      const socket = socketService.connect();

      socket.on("connect", () => {
        console.log("Therapist socket connected:", socket.id);
        socketService.emit("therapist-connect", {
          therapistId: therapist.id,
          therapistInfo: { name: therapist.name, email: therapist.email },
        });
      });

      // Listen for incoming calls via socket only
      socketService.on("incoming-call", (data) => {
        console.log("Incoming call via socket:", data);
        handleIncomingCall(data);
      });

      socketService.on("call-cancelled", (data) => {
        console.log("Call cancelled:", data);
        setShowCallModal(false);
        setIncomingCall(null);
      });

      socketService.on("call-timeout", (data) => {
        console.log("Call timeout:", data);
        setShowCallModal(false);
        setIncomingCall(null);
      });

      return () => {
        socketService.disconnect();
      };
    }
  }, [therapist]);

  const handleIncomingCall = (callData) => {
    setIncomingCall({
      userId: callData.userId,
      userName: callData.userName || "User",
      roomId: callData.roomId,
      callId: callData.callId,
      zegoCallId: callData.zegoCallId,
      callType: callData.callType || CALL_TYPES.VOICE,
    });
    setShowCallModal(true);
  };

  // Initialize Firebase and notification listeners

  // ONLY Firebase notifications handle incoming calls

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchAllData().catch((error) => {
        console.error("Error refreshing data on focus:", error);
      });
    }, [])
  );

  useEffect(() => {
    if (therapist) {
      setIsAvailable(therapist.isAvailable);
      fetchAllData().catch((error) => {
        console.error("Error fetching initial data:", error);
      });

      // Auto-refresh stats every 60 seconds when on dashboard tab
      const autoRefreshInterval = setInterval(() => {
        if (activeTab === "dashboard") {
          fetchStats(false).catch((error) => {
            console.error("Error during auto-refresh:", error);
          });
        }
      }, 60000);

      return () => {
        clearInterval(autoRefreshInterval);
      };
    }
  }, [therapist, activeTab]);

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
    if (!zegoConfigValid) {
      Alert.alert(
        "Service Unavailable",
        "Call functionality is temporarily unavailable. Cannot change availability status.",
        [{ text: "OK" }]
      );
      return;
    }

    try {
      // Notify backend of availability change via socket
      socketService.emit("therapist-availability-change", {
        therapistId: therapist.id,
        isAvailable: !isAvailable,
      });

      // Optimistic update
      setIsAvailable((prev) => !prev);

      // No need to call API here, backend will handle it based on socket event
    } catch (error) {
      console.error("Error toggling availability:", error);
      Alert.alert("Error", "Failed to update availability. Please try again.");
      setIsAvailable(therapist.isAvailable); // Revert on error
    }
  };

  const onRefresh = useCallback(() => {
    fetchAllData().catch((error) => {
      console.error("Error during refresh:", error);
    });
  }, []);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === "history") {
      fetchCallHistory(false).catch((error) => {
        console.error("Error fetching call history:", error);
      });
    } else if (tab === "dashboard") {
      fetchStats(false).catch((error) => {
        console.error("Error fetching stats:", error);
      });
    }
  };

  const handleCallAction = async (actionType) => {
    if (!incomingCall) return;

    const { callId, userId, roomId, zegoCallId, callType, userName } =
      incomingCall;

    setShowCallModal(false);
    setIncomingCall(null);

    try {
      if (actionType === "accept") {
        console.log("Accepting call with data:", {
          callId,
          userId,
          roomId,
          zegoCallId,
          callType,
          userName,
          therapist: therapist?.id,
        });

        // Notify backend via socket that call is accepted
        socketService.emit("call-accepted", {
          callId,
          therapistId: therapist.id,
          userId,
          roomId,
        });

        // Join ZegoCloud room using the unified service
        const roomInfo = await unifiedZegoService.joinRoom(
          roomId,
          therapist.id,
          therapist.name,
          true, // isTherapist
          callType
        );

        console.log("Successfully joined ZegoCloud room:", roomInfo);

        // Navigate to the call screen
        navigation.navigate("ZegoCallScreen", {
          roomId,
          callId,
          userId,
          userName: userName || "User",
          isCaller: false, // Therapist is the receiver
          zegoCallId,
          callType,
          therapistId: therapist.id,
          therapistName: therapist.name,
        });
      } else if (actionType === "reject") {
        console.log("Rejecting call:", {
          callId,
          therapistId: therapist.id,
          userId,
        });

        // Notify backend via socket that call is rejected
        socketService.emit("call-rejected", {
          callId,
          therapistId: therapist.id,
          userId,
          reason: "Therapist rejected the call",
        });

        Alert.alert("Call Rejected", "You have rejected the call.");
      }
    } catch (error) {
      console.error(`Error during call ${actionType}:`, error);
      Alert.alert(
        "Call Error",
        `Failed to ${actionType} call: ${error.message}`
      );

      // Reset the modal state on error
      setShowCallModal(false);
      setIncomingCall(null);
    }
  };

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
      dispatch(logout());
      navigation.replace("Login");
    } catch (error) {
      console.error("Error logging out:", error);
      Alert.alert("Logout Error", "Failed to log out. Please try again.");
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const options = { year: "numeric", month: "short", day: "numeric" };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const formatDuration = (minutes) => {
    if (minutes === null || minutes === undefined) return "N/A";
    if (minutes < 1) return "< 1 min";
    return `${Math.round(minutes)} min`;
  };

  const StatCard = ({ title, value, subtitle, icon, color }) => (
    <View style={[styles.statCard, { backgroundColor: color || "#fff" }]}>
      <Text>{icon}</Text>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statSubtitle}>{subtitle}</Text>
    </View>
  );

  const renderCallHistoryItem = ({ item }) => (
    <View style={styles.callHistoryItem}>
      <View style={styles.callHistoryHeader}>
        <Text style={styles.callHistoryType}>
          {item.callType === CALL_TYPES.VIDEO ? "Video Call" : "Voice Call"}
        </Text>
        <Text
          style={[
            styles.callHistoryStatus,
            { color: getStatusColor(item.status) },
          ]}
        >
          {getStatusText(item.status)}
        </Text>
      </View>
      <View style={styles.callHistoryInfo}>
        <Text style={styles.callHistoryUserName}>
          User ({item.userId?.phoneNumber?.slice(-4) || "Unknown"})
        </Text>
        <Text style={styles.callHistoryDate}>{formatDate(item.startTime)}</Text>
        <Text style={styles.callHistoryCallType}>
          {item.callType === CALL_TYPES.VIDEO ? "📹 Video" : "🎤 Voice"} Call
        </Text>
      </View>
      <View style={styles.callHistoryMeta}>
        <Text style={styles.callHistoryDuration}>
          {formatDuration(item.durationMinutes)}
        </Text>
        <Text style={styles.callHistoryEarnings}>
          +{item.therapistEarningsCoins} coins
        </Text>
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
                {!zegoConfigValid && (
                  <Text style={styles.configWarning}>
                    ⚠️ Call service unavailable
                  </Text>
                )}
              </View>
            </View>
            <Switch
              value={isAvailable && zegoConfigValid}
              onValueChange={toggleAvailability}
              trackColor={{ false: "#767577", true: "rgba(255,255,255,0.3)" }}
              thumbColor="#fff"
              disabled={!zegoConfigValid}
            />
          </View>
        </LinearGradient>
      </View>

      {/* Call Type Pricing Information */}
      <View style={styles.pricingCard}>
        <Text style={styles.pricingTitle}>💰 Call Rates</Text>
        <View style={styles.pricingRow}>
          <View style={styles.pricingItem}>
            <Text style={styles.pricingIcon}>🎤</Text>
            <Text style={styles.pricingType}>Voice Calls</Text>
            <Text style={styles.pricingEarning}>
              Earn {CALL_PRICING[CALL_TYPES.VOICE].therapistEarningsPerMinute}{" "}
              coins/min
            </Text>
          </View>
          <View style={styles.pricingDivider} />
          <View style={styles.pricingItem}>
            <Text style={styles.pricingIcon}>📹</Text>
            <Text style={styles.pricingType}>Video Calls</Text>
            <Text style={styles.pricingEarning}>
              Earn {CALL_PRICING[CALL_TYPES.VIDEO].therapistEarningsPerMinute}{" "}
              coins/min
            </Text>
          </View>
        </View>
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
            {!zegoConfigValid && (
              <View style={styles.serviceWarning}>
                <Text style={styles.serviceWarningText}>
                  ⚠️ Call service unavailable
                </Text>
              </View>
            )}
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

      {/* Enhanced Incoming Call Modal - ONLY source of incoming calls */}
      <Modal
        visible={showCallModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowCallModal(false);
          setIncomingCall(null);
        }}
      >
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={
              incomingCall?.callType === CALL_TYPES.VIDEO
                ? ["#2196F3", "#1976D2"]
                : ["#4CAF50", "#45a049"]
            }
            style={styles.callModalContent}
          >
            <View style={styles.callModalHeader}>
              <Text style={styles.callModalTitle}>
                {incomingCall?.callType === CALL_TYPES.VIDEO ? "📹" : "📞"}{" "}
                Incoming{" "}
                {incomingCall?.callType === CALL_TYPES.VIDEO
                  ? "Video"
                  : "Voice"}{" "}
                Call
              </Text>
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
              <Text style={styles.callTypeInfo}>
                {incomingCall?.callType === CALL_TYPES.VIDEO
                  ? "Video"
                  : "Voice"}{" "}
                Call
              </Text>
              <Text style={styles.earningInfo}>
                Earn{" "}
                {
                  CALL_PRICING[incomingCall?.callType || CALL_TYPES.VOICE]
                    .therapistEarningsPerMinute
                }{" "}
                coins/min
              </Text>
            </View>

            <View style={styles.callActions}>
              <TouchableOpacity
                style={styles.rejectButton}
                onPress={() => handleCallAction("reject")}
              >
                <Text style={styles.rejectIcon}>📞</Text>
                <Text style={styles.rejectText}>Decline</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.acceptButton}
                onPress={() => handleCallAction("accept")}
                disabled={!zegoConfigValid}
              >
                <Text style={styles.acceptIcon}>📞</Text>
                <Text style={styles.acceptText}>Accept</Text>
              </TouchableOpacity>
            </View>

            {!zegoConfigValid && (
              <Text style={styles.configErrorText}>
                Call service temporarily unavailable
              </Text>
            )}
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
  serviceWarning: {
    marginTop: 4,
  },
  serviceWarningText: {
    color: "#ffeb3b",
    fontSize: 12,
    fontWeight: "500",
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
  configWarning: {
    color: "#ffeb3b",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  pricingCard: {
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginBottom: 25,
    borderRadius: 15,
    padding: 20,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  pricingTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
    textAlign: "center",
  },
  pricingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  pricingItem: {
    flex: 1,
    alignItems: "center",
  },
  pricingIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  pricingType: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  pricingEarning: {
    fontSize: 12,
    color: "#4CAF50",
    fontWeight: "500",
  },
  pricingDivider: {
    width: 1,
    backgroundColor: "#e9ecef",
    marginHorizontal: 15,
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
  callHistoryItem: {
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
  callHistoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  callHistoryType: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  callHistoryStatus: {
    fontSize: 14,
    color: "#4CAF50",
    fontWeight: "500",
  },
  callHistoryInfo: {
    flex: 1,
  },
  callHistoryUserName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  callHistoryDate: {
    fontSize: 12,
    color: "#666",
    marginBottom: 2,
  },
  callHistoryCallType: {
    fontSize: 12,
    color: "#888",
    fontWeight: "500",
  },
  callHistoryMeta: {
    alignItems: "flex-end",
  },
  callHistoryDuration: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  callHistoryEarnings: {
    fontSize: 12,
    color: "#4CAF50",
    fontWeight: "500",
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
  callTypeInfo: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.8)",
    marginBottom: 5,
  },
  earningInfo: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.9)",
    fontWeight: "500",
  },
  callActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginBottom: 20,
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
  configErrorText: {
    color: "#ffeb3b",
    fontSize: 12,
    textAlign: "center",
    fontWeight: "500",
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
  configWarning: {
    color: "#ffeb3b",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  pricingCard: {
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginBottom: 25,
    borderRadius: 15,
    padding: 20,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  pricingTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
    textAlign: "center",
  },
  pricingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  pricingItem: {
    flex: 1,
    alignItems: "center",
  },
  pricingIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  pricingType: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  pricingEarning: {
    fontSize: 12,
    color: "#4CAF50",
    fontWeight: "500",
  },
  pricingDivider: {
    width: 1,
    backgroundColor: "#e9ecef",
    marginHorizontal: 15,
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
});

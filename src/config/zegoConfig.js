// src/config/zegoConfig.js
import { Platform } from "react-native";
import Constants from "expo-constants";

// Debug logging
console.log("Constants.expoConfig:", Constants.expoConfig);
console.log("Constants.expoConfig.extra:", Constants.expoConfig?.extra);

// Get ZEGO credentials with fallback and validation
let rawAppId = Constants.expoConfig?.extra?.ZEGO_APP_ID;
export const ZEGO_APP_ID =
  typeof rawAppId === "string" ? parseInt(rawAppId, 10) : rawAppId;
export const ZEGO_APP_SIGN = Constants.expoConfig?.extra?.ZEGO_APP_SIGN;

// Debug the values
console.log("ZEGO_APP_ID loaded:", ZEGO_APP_ID);
console.log("ZEGO_APP_SIGN loaded:", ZEGO_APP_SIGN ? "Present" : "Missing");

// Validate that we have valid credentials
if (!ZEGO_APP_ID || !ZEGO_APP_SIGN) {
  console.error("❌ ZEGO Configuration Error:");
  console.error("ZEGO_APP_ID:", ZEGO_APP_ID);
  console.error("ZEGO_APP_SIGN:", ZEGO_APP_SIGN ? "Present" : "Missing");
  console.error(
    "Make sure your .env file contains valid ZEGO_APP_ID and ZEGO_APP_SIGN"
  );
}

// Call Types
export const CALL_TYPES = {
  VOICE: "voice",
  VIDEO: "video",
};

// Call Status
export const CALL_STATUS = {
  INITIATED: "initiated",
  ANSWERED: "answered",
  ENDED_BY_USER: "ended_by_user",
  ENDED_BY_THERAPIST: "ended_by_therapist",
  REJECTED: "rejected",
  MISSED: "missed",
  CANCELLED: "cancelled",
  BUSY: "busy",
  OFFLINE: "offline",
};

// Pricing Configuration
export const CALL_PRICING = {
  [CALL_TYPES.VOICE]: {
    costPerMinute: 5,
    therapistEarningsPerMinute: 2.5,
    minimumMinutes: 1,
  },
  [CALL_TYPES.VIDEO]: {
    costPerMinute: 8,
    therapistEarningsPerMinute: 4,
    minimumMinutes: 1,
  },
};

// Platform-specific configurations
export const PLATFORM_CONFIG = {
  android: {
    enableHardwareEchoCancel: true,
    enableHardwareNoiseSuppress: true,
    enableAgc: true,
    enableDtx: false,
  },
  ios: {
    enableHardwareEchoCancel: true,
    enableHardwareNoiseSuppress: true,
    enableAgc: true,
    enableDtx: false,
  },
};

// Get platform-specific config
export const getPlatformConfig = () => {
  return PLATFORM_CONFIG[Platform.OS] || PLATFORM_CONFIG.android;
};

// Enhanced validation with detailed error reporting
export const validateZegoConfig = () => {
  const errors = [];

  if (!ZEGO_APP_ID) {
    errors.push("ZEGO_APP_ID is missing or null");
  } else if (
    typeof ZEGO_APP_ID !== "number" &&
    isNaN(parseInt(ZEGO_APP_ID, 10))
  ) {
    errors.push("ZEGO_APP_ID should be a valid number");
  } else if (
    ZEGO_APP_ID === 1234567890 ||
    parseInt(ZEGO_APP_ID, 10) === 1234567890
  ) {
    errors.push("ZEGO_APP_ID is using default/example value");
  }

  if (!ZEGO_APP_SIGN) {
    errors.push("ZEGO_APP_SIGN is missing or null");
  } else if (typeof ZEGO_APP_SIGN !== "string") {
    errors.push("ZEGO_APP_SIGN should be a string");
  } else if (ZEGO_APP_SIGN.includes("your_") || ZEGO_APP_SIGN.length < 10) {
    errors.push("ZEGO_APP_SIGN appears to be using default/example value");
  }

  const result = {
    isValid: errors.length === 0,
    errors,
    config: {
      appId: ZEGO_APP_ID,
      appSign: ZEGO_APP_SIGN ? "Present" : "Missing",
    },
  };

  if (!result.isValid) {
    console.error("❌ ZEGO Configuration Validation Failed:", result);
  } else {
    console.log("✅ ZEGO Configuration is valid");
  }

  return result;
};

// Quality settings for different network conditions
export const QUALITY_SETTINGS = {
  HIGH: {
    video: {
      width: 720,
      height: 1280,
      fps: 30,
      bitrate: 1200,
    },
    audio: {
      bitrate: 64,
      codec: "OPUS",
    },
  },
  MEDIUM: {
    video: {
      width: 540,
      height: 960,
      fps: 24,
      bitrate: 800,
    },
    audio: {
      bitrate: 48,
      codec: "OPUS",
    },
  },
  LOW: {
    video: {
      width: 360,
      height: 640,
      fps: 15,
      bitrate: 400,
    },
    audio: {
      bitrate: 32,
      codec: "OPUS",
    },
  },
};

// Call timeout settings
export const CALL_TIMEOUTS = {
  INVITATION_TIMEOUT: 30000,
  CONNECTION_TIMEOUT: 15000,
  RECONNECTION_TIMEOUT: 10000,
  MAX_RECONNECTION_ATTEMPTS: 3,
};

// UI Configuration
export const UI_CONFIG = {
  colors: {
    primary: "#4A90E2",
    secondary: "#667eea",
    success: "#4CAF50",
    danger: "#f44336",
    warning: "#ff9800",
    dark: "#1e1e1e",
    light: "#ffffff",
  },
  callScreen: {
    backgroundColor: "#1e1e1e",
    showCallDuration: true,
    showNetworkQuality: true,
    enableBeautyFilter: false,
    enableVirtualBackground: false,
  },
};

// Feature flags
export const FEATURE_FLAGS = {
  ENABLE_CALL_RECORDING: false,
  ENABLE_SCREEN_SHARING: false,
  ENABLE_GROUP_CALLS: false,
  ENABLE_CALL_QUALITY_FEEDBACK: true,
  ENABLE_NETWORK_QUALITY_INDICATOR: true,
  ENABLE_CALL_INVITATION_PUSH: true,
};

// Development helpers
export const DEV_CONFIG = {
  enableDebugLogs: __DEV__,
  enableCallSimulation: __DEV__,
  mockCallDuration: 60,
  enablePerformanceMonitoring: true,
};

// Run validation on import
validateZegoConfig();

export default {
  ZEGO_APP_ID,
  ZEGO_APP_SIGN,
  CALL_TYPES,
  CALL_STATUS,
  CALL_PRICING,
  PLATFORM_CONFIG,
  QUALITY_SETTINGS,
  CALL_TIMEOUTS,
  UI_CONFIG,
  FEATURE_FLAGS,
  DEV_CONFIG,
  getPlatformConfig,
  validateZegoConfig,
};

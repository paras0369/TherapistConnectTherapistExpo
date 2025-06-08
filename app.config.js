import "dotenv/config";

console.log("ZEGO_APP_ID from env:", process.env.ZEGO_APP_ID);
console.log("ZEGO_APP_SIGN from env:", process.env.ZEGO_APP_SIGN);

export default {
  expo: {
    name: "TherapyConnect Therapist",
    slug: "therapyconnect-therapist",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.therapyconnecttherapist",
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      package: "com.therapistconnect.therapist",
      permissions: [
        "android.permission.RECORD_AUDIO",
        "android.permission.MODIFY_AUDIO_SETTINGS",
        // Add camera permission for video calls
        "android.permission.CAMERA",
      ],
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    plugins: [
      "expo-font",
      // Add dev client plugin for better debugging
      "expo-dev-client",
    ],
    extra: {
      ZEGO_APP_ID: process.env.ZEGO_APP_ID
        ? parseInt(process.env.ZEGO_APP_ID, 10)
        : null,
      ZEGO_APP_SIGN: process.env.ZEGO_APP_SIGN || null,
      eas: {
        projectId: "YOUR_EAS_PROJECT_ID",
      },
    },
  },
};

import { Tabs } from "expo-router";
import { Text, View } from "react-native";

const CORAL = "#d94f3d";
const TEAL = "#0f766e";
const MUTED = "#8a7a6a";

function TabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  return (
    <View style={{ alignItems: "center", paddingTop: 6 }}>
      <Text style={{ fontSize: 18 }}>{emoji}</Text>
      <Text
        style={{
          fontSize: 10,
          fontWeight: focused ? "700" : "500",
          color: focused ? CORAL : MUTED,
          marginTop: 2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: CORAL,
        tabBarInactiveTintColor: MUTED,
        tabBarStyle: { backgroundColor: "#ffffff", borderTopColor: "#eee5d8", height: 84 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "The Commons",
          tabBarIcon: ({ focused }) => <TabIcon emoji="📰" label="Commons" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="polls"
        options={{
          title: "Polls",
          tabBarIcon: ({ focused }) => <TabIcon emoji="📊" label="Polls" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="rewards"
        options={{
          title: "Rewards",
          tabBarIcon: ({ focused }) => <TabIcon emoji="🎁" label="Rewards" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "You",
          tabBarIcon: ({ focused }) => <TabIcon emoji="🦜" label="You" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import colors from "@/constants/colors";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Page Not Found" }} />
      <View style={styles.container}>
        <Text style={styles.title} accessibilityRole="header">This screen doesn&apos;t exist.</Text>

        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Return to Home</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: colors.white,
  },
  title: {
    fontSize: 20,
    fontWeight: "600" as const,
    color: colors.govGrey1,
    marginBottom: 20,
  },
  link: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: colors.govBlue,
    borderRadius: 4,
  },
  linkText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: colors.white,
  },
});

import React, { useState, useEffect } from "react";

//react native
import {
  ActivityIndicator,
  Text,
  View,
  ScrollView,
  StyleSheet,
  Button,
  Platform,
} from "react-native";
export default function TextDisplay(props) {
  const { store, styles } = props;
  const [word, setWord] = useState("");
  setInterval(() => setWord(store.getWord), 1000);
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{word}</Text>
    </View>
  );
}

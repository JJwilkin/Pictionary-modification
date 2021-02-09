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
  setInterval(() => {
    store.prediction(true);
    setWord(store.getWord);
    setTimeout(() => {
      store.prediction(false);
    }, 400);
  }, 1000);

  // setInterval(() => {
  //   let currentPrediction = store.getWord;

  //   setTimeout(()=>{
  //     if (currentPrediction = store.getWord) {
  //       store.toggle("");
  //     }
  //   }, 1500)

  // }, 2500);
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{word}</Text>
      {/* <Button onPress={() => store.}/> */}
    </View>
  );
}

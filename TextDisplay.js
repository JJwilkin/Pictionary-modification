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
  // setInterval(() => {
  //   store.prediction(true);
  //   setWord(store.getWord);
  //   setTimeout(() => {
  //     store.prediction(false);
  //   }, 400);
  // }, 2000);
const triggerPrediction = () => {
  store.prediction(true);
  setTimeout(() => {
    setWord(store.getWord);
    store.prediction(false);
  }, 300)
}
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
      <Button title="Get Prediction" onPress={triggerPrediction}/>
    </View>
  );
}

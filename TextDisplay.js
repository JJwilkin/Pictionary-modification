import React, { useState, useEffect } from 'react';

//react native
import { ActivityIndicator, Text, View, ScrollView, StyleSheet, Button, Platform } from 'react-native';
export default function TextDisplay (props) {
    const { store } = props;
    const [word, setWord] = useState("")
    setInterval(() => setWord(store.getWord), 1000);
    return (
    <View>
        <Text>
            {store.getWord}
        </Text>
        {/* <Button title="Click" onPress={() => setWord(store.getWord)}/> */}
    </View>)

}
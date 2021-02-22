import React, { useState, useEffect, useRef } from 'react';

import TextDisplay from './TextDisplay';
//react native
import { ActivityIndicator, Text, View, ScrollView, StyleSheet, Button, Platform } from 'react-native';

//picker
import RNPickerSelect from 'react-native-picker-select';
import { Chevron } from 'react-native-shapes';

//Expo
import Constants from 'expo-constants';
import * as Permissions from 'expo-permissions';
import { Camera } from 'expo-camera';

//Tensorflow
import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';
import {cameraWithTensors} from '@tensorflow/tfjs-react-native';
import * as knnClassifier from '@tensorflow-models/knn-classifier';

//disable yellow warnings on EXPO client!
console.disableYellowBox = true;


import { makeObservable, observable, action, computed } from "mobx"

class WordPrediction {
    word = ""
    showPrediction = false
    constructor() {
        makeObservable(this, {
            word: observable,
            toggle: action,
            getWord: computed,
            getShowPrediction: computed,
            prediction: action,
            showPrediction:observable,

        })
    }
    get getWord () {
      // console.log(this.word)
      return this.word
    }
    
    get getShowPrediction () {
      return this.showPrediction;
    }

    toggle(word) {
        this.word = word
        // console.log(word)
    }

    prediction(val) {
      this.showPrediction = val;
    }
}


export default function App() {

  //------------------------------------------------
  //state variables for image/translation processing
  //------------------------------------------------
  const store = new WordPrediction();
  const camera = useRef(null)
  const [word, setWord] = useState('');
  const [translation, setTranslation] = useState('');
  const [language, setLanguage] =  useState('he');
  const [translationAvailable, setTranslationAvailable] = useState(true);
  const [predictionFound, setPredictionFound] = useState(false);
  const [hasPermission, setHasPermission] = useState(null);
  const [classifier, setClassifier] = useState(null);

  //Tensorflow and Permissions
  const [mobilenetModel, setMobilenetModel] = useState(null);
  const [frameworkReady, setFrameworkReady] = useState(false);

  //defaults

  //if adding more languages, map codes from this list:
  // https://cloud.google.com/translate/docs/languages
  const availableLanguages = [
    { label: 'Hebrew', value: 'he' },
    { label: 'Arabic', value: 'ar' },
    { label: 'Mandarin Chinese', value: 'zh' }
  ];
  const GoogleTranslateAPI = "https://translation.googleapis.com/language/translate/v2";
  const GoogleAPIKey = "";

  //TF Camera Decorator
  const TensorCamera = cameraWithTensors(Camera);

  //RAF ID
  let requestAnimationFrameId = 0;

  //performance hacks (Platform dependent)
  const textureDims = Platform.OS === "ios"? { width: 1080, height: 1920 } : { width: 1600, height: 1200 };
  const tensorDims = { width: 152, height: 200 }; 

  //-----------------------------
  // Run effect once
  // 1. Check camera permissions
  // 2. Initialize TensorFlow
  // 3. Load Mobilenet Model
  //-----------------------------
  useEffect(() => {
    if(!frameworkReady) {
      (async () => {

        setClassifier(knnClassifier.create())
        //check permissions
        const { status } = await Camera.requestPermissionsAsync();
        console.log(`permissions status: ${status}`);
        setHasPermission(status === 'granted');

        //we must always wait for the Tensorflow API to be ready before any TF operation...
        await tf.ready();

        //load the mobilenet model and save it in state
        setMobilenetModel(await loadMobileNetModel());

        setFrameworkReady(true);
      })();
    }
  }, [frameworkReady]);
  
  useEffect(()=> {
    // console.log(word)
  }, [word, translation])

  const addExample = async classId => {
    // Capture an image from the web camera.
    if (camera) {
      let photo = await camera.takePictureAsync();
      const activation = net.infer(photo, true);

    // Pass the intermediate activation to the classifier.
      classifier.addExample(activation, classId);
    }
  };

  //--------------------------
  // Run onUnmount routine
  // for cancelling animation 
  // if running to avoid leaks
  //--------------------------
  useEffect(() => {
    return () => {
      cancelAnimationFrame(requestAnimationFrameId);
    };
  }, [requestAnimationFrameId]);

  //--------------------------------------------------------------
  // Helper asynchronous function to invoke the Google Translation
  // API and fetch the translated text. Excellent documentation
  // for parameters and response data structure is here 
  // (Translating text (Basic)):
  // https://cloud.google.com/translate/docs/basic/quickstart
  //
  // NOTE: Here we are using the simple GET with key model. While
  // this is simple to implement, it is recommended to do a POST
  // with an OAuth key to avoid key tampering. This approach is
  // for instructional purposes ONLY.
  //---------------------------------------------------------------
  const getTranslation = async (className) => {
    try {
      const googleTranslateApiEndpoint = `${GoogleTranslateAPI}?q=${className}&target=${language}&format=html&source=en&model=nmt&key=${GoogleAPIKey}`;
      console.log(`Attempting to hit Google API Endpoint: ${googleTranslateApiEndpoint}`);
      
      const apiCall = await fetch(googleTranslateApiEndpoint);
      if(!apiCall){ 
        console.error(`Google API did not respond adequately. Review API call.`);
        //throw new Error(`Google API did not respond.`);
        setTranslation(`Cannot get transaction at this time. Please try again later`);
      }

      //get JSON data
      let response = await apiCall.json();
      if(!response.data || !response.data.translations || response.data.translations.length === 0){ 
        console.error(`Google API unexpected response. ${response}`);
        //throw new Error(`Google API responded with invalid data.`);
        setTranslation(`Cannot get transaction at this time. Please try again later`);
      }

      // we only care about the first occurrence
      console.log(`Translated text is: ${response.data.translations[0].translatedText}`);
      setTranslation(response.data.translations[0].translatedText); 
      // setWord(className);
    } catch (error) {
      console.error(`Error while attempting to get translation from Google API. Error: ${error}`);
      setTranslation(`Cannot get transaction at this time. Please try again later`);
    } 

    setTranslationAvailable(true);
  }

  //-----------------------------------------------------------------
  // Loads the mobilenet Tensorflow model: 
  // https://github.com/tensorflow/tfjs-models/tree/master/mobilenet
  // Parameters:
  // 
  // NOTE: Here, I suggest you play with the version and alpha params
  // as they control performance and accuracy for your app. For instance,
  // a lower alpha increases performance but decreases accuracy. More
  // information on this topic can be found in the link above.  In this
  // tutorial, I am going with the defaults: v1 and alpha 1.0
  //-----------------------------------------------------------------
  const loadMobileNetModel = async () => {
    const model = await mobilenet.load();
    return model;
  }


  //----------------------------------------------------------------------------------------
  // MobileNet tensorflow model classify operation returns an array of prediction objects 
  // with this structure: prediction = [ {"className": "object name", "probability": 0-1 } ]
  // where:
  // className = The class of the object being identified. Currently, this model identifies 1000 different classes.
  // probability = Number between 0 and 1 that represents the prediction's probability 
  // Example (with a topk parameter set to 3 => default):
  // [
  //   {"className":"joystick","probability":0.8070220947265625},
  //   {"className":"screen, CRT screen","probability":0.06108357384800911},
  //   {"className":"monitor","probability":0.04016926884651184}
  // ]
  // In this case, we use topk set to 1 as we are interested in the higest result for
  // both performance and simplicity. This means the array will return 1 prediction only!
  //----------------------------------------------------------------------------------------
  const getPrediction = async(tensor) => {
    if (!tensor && tensor != null && !store.getShowPrediction && false) return;
   
    //topk set to 1
    const prediction = await mobilenetModel.classify(tensor, 1);
    // console.log(`prediction: ${JSON.stringify(prediction)}`);

    if(!prediction || prediction.length === 0) { return; }
    
    //only attempt translation when confidence is higher than 20%
    if(prediction[0].probability > 0.4) {

      //stop looping!
      // cancelAnimationFrame(requestAnimationFrameId);
      // setPredictionFound(true);
      // setWord(prediction[0].className);
      store.toggle(prediction[0].className);
      // console.log(store.word)
      //get translation!
      // await getTranslation(prediction[0].className);
    }
  }

  //------------------------------------------------------------------------------
  // Helper function to handle the camera tensor streams. Here, to keep up reading
  // input streams, we use requestAnimationFrame JS method to keep looping for 
  // getting better predictions (until we get one with enough confidence level).
  // More info on RAF:
  // https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame
  //------------------------------------------------------------------------------
  const handleCameraStream = (imageAsTensors) => {
    // const loop = async () => {
      
    //   // if ( Platform.OS !== "ios" && Math.random()*50 % 50 == 1) run = false;
    //   // else if( Math.random()*7 % 7 == 0 ) { run = false; }
    //     const nextImageTensor = await imageAsTensors.next().value;
    //     await getPrediction(nextImageTensor);
    //     requestAnimationFrameId = requestAnimationFrame(loop);
    //   }
      
    
    // if(!predictionFound) loop();
  }

  //------------------------------------------------------
  // Helper function to reset all required state variables 
  // to start a fresh new translation routine! 
  //------------------------------------------------------
  const loadNewTranslation = () => {
    setTranslation('');
    setWord('');
    setPredictionFound(false);
    setTranslationAvailable(false);
  }

  //------------------------------------------------------
  // Helper function to render the language picker
  //------------------------------------------------------
  const showLanguageDropdown = () => {
    return  <View>
              <RNPickerSelect
                placeholder={{}}
                onValueChange={(value) => setLanguage(value)}
                items={availableLanguages} 
                value={language}
                style={pickerSelectStyles}
                useNativeAndroidPickerStyle={false}
                Icon={() => {
                  return <Chevron style={{marginTop: 20, marginRight: 15}} size={1.5} color="gray" />;
                }}
              />
                
            </View>  
  }

  //----------------------------------------------
  // Helper function to show the Translation View. 
  //----------------------------------------------
  const showTranslationView = () => { 
    return  <View style={styles.translationView}>
              {
                translationAvailable ?
                  <View>
                    <ScrollView style={{height:400}}>
                      <Text style={styles.translationTextField}>{translation}</Text>
                      <Text style={styles.wordTextField}>{word}</Text>
                    </ScrollView>
                    <Button color='#9400D3' title="Check new word" onPress={() => loadNewTranslation()}/>
                  </View>
                : <ActivityIndicator size="large"/>
              }
            </View>
  }

  //--------------------------------------------------------------------------------
  // Helper function to show the Camera View. 
  //
  // NOTE: Please note we are using TensorCamera component which is constructed 
  // on line: 37 of this function component. This is just a decorated expo.Camera 
  // component with extra functionality to stream Tensors, define texture dimensions
  // and other goods. For further research:
  // https://js.tensorflow.org/api_react_native/0.2.1/#cameraWithTensors
  //--------------------------------------------------------------------------------
  const renderCameraView = () => {
    return <View style={styles.cameraView}>
                <TensorCamera
                  style={styles.camera}
                  type={Camera.Constants.Type.back}
                  zoom={0}
                  cameraTextureHeight={textureDims.height}
                  cameraTextureWidth={textureDims.width}
                  resizeHeight={tensorDims.height}
                  resizeWidth={tensorDims.width}
                  resizeDepth={3}
                  onReady={ handleCameraStream}
                  autorender={true}
                  ref={ref => {
                    this.camera = ref;
                  }}
                />
                <Text style={styles.legendTextField}>Point to any object and get its {availableLanguages.find(al => al.value === language).label } translation</Text>
            </View>;
  }

  return (
    <View style={styles.container}>
      {/* <View style={styles.header}>
        <Text style={styles.title}>
          {word}
        </Text>
      </View> */}
      <TextDisplay store={store} styles={styles}/>
      <View style={styles.body}>
        { frameworkReady ? renderCameraView() : <Text styles={styles.title}>Loading</Text> }
        <Button title='Apple' onPress={async ()=>await this.camera.takePictureAsync()} />
      </View>  
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: Constants.statusBarHeight,
    backgroundColor: '#E8E8E8',
  },
  header: {
    backgroundColor: '#41005d'
  },
  title: {
    margin: 10,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#ffffff'
  },
  body: {
    padding: 5,
    paddingTop: 25
  },
  cameraView: {
    display: 'flex',
    flex:1,
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    width: '100%',
    height: '100%',
    paddingTop: 10
  },
  camera : {
    width: 700/2,
    height: 800/2,
    zIndex: 1,
    borderWidth: 0,
    borderRadius: 0,
  },
  translationView: {
    marginTop: 30, 
    padding: 20,
    borderColor: '#cccccc',
    borderWidth: 1,
    borderStyle: 'solid',
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    height: 500
  },
  translationTextField: {
    fontSize:60
  },
  wordTextField: {
    textAlign:'right', 
    fontSize:20, 
    marginBottom: 50
  },
  legendTextField: {
    fontStyle: 'italic',
    color: '#888888'
  },
  inputAndroid: {
    fontSize: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'purple',
    borderStyle: 'solid',
    borderRadius: 8,
    color: 'black',
    paddingRight: 30,
    backgroundColor: '#ffffff'
  },
});

const pickerSelectStyles = StyleSheet.create({
  inputIOS: {
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'gray',
    borderRadius: 4,
    color: 'black',
    paddingRight: 30
  },
  inputAndroid: {
    fontSize: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 0.5,
    borderColor: 'grey',
    borderRadius: 3,
    color: 'black',
    paddingRight: 30,
    backgroundColor: '#cccccc'
  },
});

/*
 * Copyright 2019 Amazon.com, Inc. or its affiliates.  All Rights Reserved.
 *
 * You may not use this file except in compliance with the terms and conditions 
 * set forth in the accompanying LICENSE.TXT file.
 *
 * THESE MATERIALS ARE PROVIDED ON AN "AS IS" BASIS. AMAZON SPECIFICALLY DISCLAIMS, WITH 
 * RESPECT TO THESE MATERIALS, ALL WARRANTIES, EXPRESS, IMPLIED, OR STATUTORY, INCLUDING 
 * THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
*/

// This skill sample demonstrates how to send directives and receive events from an Echo connected gadget.
// This skill uses the Alexa Skills Kit SDK (v2). Please visit https://alexa.design/cookbook for additional
// examples on implementing slots, dialog management, session persistence, api calls, and more.

const Alexa = require('ask-sdk-core');
const Util = require('./util');
const Common = require('./common');

// The audio tag to include background music
const BG_MUSIC = '<audio src="soundbank://soundlibrary/ui/gameshow/amzn_ui_sfx_gameshow_waiting_loop_30s_01"></audio>';

// The namespace of the custom directive to be sent by this skill
const NAMESPACE = 'Custom.Mindstorms.Gadget';

// The name of the custom directive to be sent this skill
const NAME_CONTROL = 'control';

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle: async function(handlerInput) {

        const request = handlerInput.requestEnvelope;
        const { apiEndpoint, apiAccessToken } = request.context.System;
        const apiResponse = await Util.getConnectedEndpoints(apiEndpoint, apiAccessToken);
        if ((apiResponse.endpoints || []).length === 0) {
            return handlerInput.responseBuilder
            .speak(`I couldnt find an EV3 Brick connected to this Echo device. Please check to make sure your EV3 Brick is connected, and try again.`)
            .getResponse();
        }

        // Store the gadget endpointId to be used in this skill session
        const endpointId = apiResponse.endpoints[0].endpointId || [];
        Util.putSessionAttribute(handlerInput, 'endpointId', endpointId);

        // Set skill duration to 5 minutes (ten 30-seconds interval)
        Util.putSessionAttribute(handlerInput, 'duration', 10);

        // Set the token to track the event handler
        const token = handlerInput.requestEnvelope.request.requestId;
        Util.putSessionAttribute(handlerInput, 'token', token);

        let speechOutput = "Welcome to air purifier, built out of LEGO EV3, how can I help you?";
        return handlerInput.responseBuilder
            .speak(speechOutput + BG_MUSIC)
            .addDirective(Util.buildStartEventHandler(token,60000, {}))
            .getResponse();
    }
};


// Construct and send a custom directive to the connected gadget with data from
// the AirQualityIntentHandler.
const AirQualityIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AirQualityIntent';
    },
    handle: function (handlerInput) {
        const attributesManager = handlerInput.attributesManager;
        let endpointId = attributesManager.getSessionAttributes().endpointId || [];

        // Construct the directive with the payload containing the move parameters
        let directive = Util.build(endpointId, NAMESPACE, NAME_CONTROL,
            {
                type: 'airquality'
            });

        let speechOutput = 'Checking air quality';
        
        return handlerInput.responseBuilder
            .speak(speechOutput + BG_MUSIC)
            .addDirective(directive)
            .getResponse();
    }
};

// Construct and send a custom directive to the connected gadget with data from
// the TemperatureIntentHandler.
const TemperatureIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'TemperatureIntent';
    },
    handle: function (handlerInput) {
        const attributesManager = handlerInput.attributesManager;
        let endpointId = attributesManager.getSessionAttributes().endpointId || [];
        let unit = 'celsius';
        let temp = Alexa.getSlotValue(handlerInput.requestEnvelope, 'Unit');
        if (temp) {
            unit = temp;
        }
        
        // Construct the directive with the payload containing the move parameters
        let directive = Util.build(endpointId, NAMESPACE, NAME_CONTROL,
            {
                type: 'temperature',
                unit: unit
            });

        let speechOutput = 'Checking air Temperature in ' + unit;
        
        return handlerInput.responseBuilder
            .speak(speechOutput + BG_MUSIC)
            .addDirective(directive)
            .getResponse();
    }
};


// changing the speed value
// This allows other intent handler to use the specified speed value
// without asking the user for input.
const SetSpeedIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'SetSpeedIntent';
    },
    handle: function (handlerInput) {
        const attributesManager = handlerInput.attributesManager;
        let endpointId = attributesManager.getSessionAttributes().endpointId || [];
        // Bound speed to (1-100)
        let speed = Alexa.getSlotValue(handlerInput.requestEnvelope, 'Speed');
        speed = Math.max(1, Math.min(100, parseInt(speed)));

        // Construct the directive with the payload containing the move parameters
        let directive = Util.build(endpointId, NAMESPACE, NAME_CONTROL,
            {
                type: 'speed',
                speed: speed
            });


        let speechOutput = `purifier speed set to ${speed} percent.`;
        return handlerInput.responseBuilder
            .speak(speechOutput + BG_MUSIC)
            .addDirective(directive)
            .getResponse();
    }
};

// Construct and send a custom directive to the connected gadget with data from
// the SetModeIntentHandler.
const SetModeIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'SetModeIntent';
    },
    handle: function (handlerInput) {

        let mode = Alexa.getSlotValue(handlerInput.requestEnvelope, 'Mode');
        if (!mode) {
            return handlerInput.responseBuilder
                .speak("Can you repeat that?")
                .withShouldEndSession(false)
                .getResponse();
        }
        
        const attributesManager = handlerInput.attributesManager;
        let endpointId = attributesManager.getSessionAttributes().endpointId || [];
        
        let speed = 0;
        
        if(mode === "high")
            speed = 100;
        else if(mode === "medium")
            speed = 60;
        else if(mode === "low")
            speed = 25;
        else if(mode === "off")    
            speed = 0;
            
        // Construct the directive with the payload containing the move parameters
        let directive = Util.build(endpointId, NAMESPACE, NAME_CONTROL,
            {
                type: 'speed',
                speed: speed
            });

        let speechOutput = 'Setting air purifier to ' + mode;
        
        return handlerInput.responseBuilder
            .speak(speechOutput + BG_MUSIC)
            .addDirective(directive)
            .getResponse();
    }
};


// Construct and send a custom directive to the connected gadget with data from
// the AutohIntentHandler.
const AutoIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AutoIntent';
    },
    handle: function (handlerInput) {

        let onoff = Alexa.getSlotValue(handlerInput.requestEnvelope, 'OnOff');
        if (!onoff) {
            return handlerInput.responseBuilder
                .speak("Can you repeat that?")
                .withShouldEndSession(false)
                .getResponse();
        }
        
        const attributesManager = handlerInput.attributesManager;
        let endpointId = attributesManager.getSessionAttributes().endpointId || [];

        // Construct the directive with the payload containing the move parameters
        let directive = Util.build(endpointId, NAMESPACE, NAME_CONTROL,
            {
                type: 'auto',
                command: onoff
            });

        let speechOutput = 'Turning auto mode ' + onoff;
        
        return handlerInput.responseBuilder
            .speak(speechOutput + BG_MUSIC)
            .addDirective(directive)
            .getResponse();
    }
};

// Construct and send a custom directive to the connected gadget with data from
// the AutohIntentHandler.
const YesNoIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'YesNoIntent';
    },
    handle: function (handlerInput) {

        let yesno = Alexa.getSlotValue(handlerInput.requestEnvelope, 'YesNo');
        if (!yesno) {
            return handlerInput.responseBuilder
                .speak("Can you repeat that?")
                .withShouldEndSession(false)
                .getResponse();
        }
        
        const attributesManager = handlerInput.attributesManager;
        let endpointId = attributesManager.getSessionAttributes().endpointId || [];

        if(yesno.includes("yes"))
        {
            // Construct the directive with the payload containing the move parameters
            let directive = Util.build(endpointId, NAMESPACE, NAME_CONTROL,
                {
                    type: 'speed',
                    speed: 100
                });
                
            let speechOutput = 'Setting air purifier to high mode';
            
            return handlerInput.responseBuilder
                .speak(speechOutput + BG_MUSIC)
                .addDirective(directive)
                .getResponse();   
        }
        else
        {
            let speechOutput = 'Ok, you can ask me to set the speed anytime.';
            
            return handlerInput.responseBuilder
                .speak(speechOutput + BG_MUSIC)
                .getResponse();   
        }
    }
};

const EventsReceivedRequestHandler = {
    // Checks for a valid token and endpoint.
    canHandle(handlerInput) {
        let { request } = handlerInput.requestEnvelope;
        console.log('Request type: ' + Alexa.getRequestType(handlerInput.requestEnvelope));
        if (request.type !== 'CustomInterfaceController.EventsReceived') return false;

        const attributesManager = handlerInput.attributesManager;
        let sessionAttributes = attributesManager.getSessionAttributes();
        let customEvent = request.events[0];

        // Validate event token
        if (sessionAttributes.token !== request.token) {
            console.log("Event token doesn't match. Ignoring this event");
            return false;
        }

        // Validate endpoint
        let requestEndpoint = customEvent.endpoint.endpointId;
        if (requestEndpoint !== sessionAttributes.endpointId) {
            console.log("Event endpoint id doesn't match. Ignoring this event");
            return false;
        }
        return true;
    },
    handle(handlerInput) {

        console.log("== Received Custom Event ==");
        let customEvent = handlerInput.requestEnvelope.request.events[0];
        let payload = customEvent.payload;
        let name = customEvent.header.name;

        let speechOutput;
        if (name === 'AirQuality') {
            let speechOutput = payload.speech;
            if(payload.request)
            {
                return handlerInput.responseBuilder
                    .speak(speechOutput + BG_MUSIC, "REPLACE_ALL")
                    .withShouldEndSession(false)
                    .getResponse();                   
            }
            else{
                return handlerInput.responseBuilder
                .speak(speechOutput + BG_MUSIC, "REPLACE_ALL")
                .getResponse();   
            }
        }
        else{
            if (payload.speech) {
                speechOutput = payload.speech;
            }
            return handlerInput.responseBuilder
                .speak(speechOutput + BG_MUSIC, "REPLACE_ALL")
                .getResponse();
        }
    }
};
const ExpiredRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'CustomInterfaceController.Expired'
    },
    handle(handlerInput) {
        console.log("== Custom Event Expiration Input ==");

        // Set the token to track the event handler
        const token = handlerInput.requestEnvelope.request.requestId;
        Util.putSessionAttribute(handlerInput, 'token', token);

        const attributesManager = handlerInput.attributesManager;
        let duration = attributesManager.getSessionAttributes().duration || 0;
        if (duration > 0) {
            Util.putSessionAttribute(handlerInput, 'duration', --duration);

            // Extends skill session
            const speechOutput = `${duration} minutes remaining.`;
            return handlerInput.responseBuilder
                .addDirective(Util.buildStartEventHandler(token, 60000, {}))
                .speak(speechOutput + BG_MUSIC)
                .getResponse();
        }
        else {
            // End skill session
            return handlerInput.responseBuilder
                .speak("Skill duration expired. Goodbye.")
                .withShouldEndSession(true)
                .getResponse();
        }
    }
};

// The SkillBuilder acts as the entry point for your skill, routing all request and response
// payloads to the handlers above. Make sure any new handlers or interceptors you've
// defined are included below. The order matters - they're processed top to bottom.
exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        AirQualityIntentHandler,
        TemperatureIntentHandler,
        SetSpeedIntentHandler,
        SetModeIntentHandler,
        AutoIntentHandler,
        YesNoIntentHandler,
        EventsReceivedRequestHandler,
        ExpiredRequestHandler,
        Common.HelpIntentHandler,
        Common.CancelAndStopIntentHandler,
        Common.SessionEndedRequestHandler,
        Common.IntentReflectorHandler, // make sure IntentReflectorHandler is last so it doesn't override your custom intent handlers
    )
    .addRequestInterceptors(Common.RequestInterceptor)
    .addErrorHandlers(
        Common.ErrorHandler,
    )
    .lambda();
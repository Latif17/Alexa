'use strict';
var globalAction = "";
var AWS = require('aws-sdk');

/*
var APP_ID = "amzn1.ask.skill.fc63603b-9068-4f96-b420-e2240f3101b8";
var AlexaSkill = require('./AlexaSkill');
var GoogleSpreadsheet = require('google-spreadsheet');
var async = require('async');
*/

// --------------- Helpers that build all of the responses -----------------------

function buildSpeechletResponse(title, output, repromptText, shouldEndSession) {
    return {
        outputSpeech: {
            type: 'PlainText',
            text: output,
        },
        card: {
            type: 'Simple',
            title: `SessionSpeechlet - ${title}`,
            content: `SessionSpeechlet - ${output}`,
        },
        reprompt: {
            outputSpeech: {
                type: 'PlainText',
                text: repromptText,
            },
        },
        shouldEndSession,
    };
}

function buildResponse(sessionAttributes, speechletResponse) {
    return {
        version: '1.0',
        sessionAttributes,
        response: speechletResponse,
    };
}

// --------------- Functions that control the skill's behavior -----------------------

function getWelcomeResponse(callback) {
    // If we wanted to initialize the session to have some attributes we could add those here.
    const sessionAttributes = {};
    const cardTitle = 'Welcome';
    const speechOutput = 'What is your action?';
    // If the user either does not reply to the welcome message or says something that is not understood, they will be prompted again with this text.
    const repromptText = 'What is your action?';
    const shouldEndSession = false;
    callback(sessionAttributes, buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
}

function getWelcomeResponseRestart(callback) {
    // If we wanted to initialize the session to have some attributes we could add those here.
    const sessionAttributes = {};
    const cardTitle = 'Welcome';
    const speechOutput = '';
    // If the user either does not reply to the welcome message or says something that is not
    // understood, they will be prompted again with this text.
    const repromptText = '';
    const shouldEndSession = false;
    callback(sessionAttributes, buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
}


function handleSessionEndRequest(callback) {
    const cardTitle = 'Session Ended';
    const speechOutput = 'Goodbye';
    // Setting this to true ends the session and exits the skill.
    const shouldEndSession = true;
    callback({}, buildSpeechletResponse(cardTitle, speechOutput, null, shouldEndSession));
}

function createActionAttributes(action) {
    return {
        action,
    };
}

function setActionInSession(intent, session, callback) {
    const cardTitle = intent.action;
    const actionSlot = intent.slots.Action;
    let repromptText = '';
    let sessionAttributes = {};
    const shouldEndSession = false;
    let speechOutput = '';
    var action;
    if (actionSlot) {
        action = actionSlot.value.toLowerCase();
        globalAction = action;
    } else {
        speechOutput = "ActionErr";
        repromptText = "ActionErr";
    }
    writeToDatabaseIntent(intent, session, callback);
    callback(sessionAttributes, buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
    getWelcomeResponseRestart(callback);
}

function writeToDatabaseIntent(intent, session, callback) {
    const cardTitle = intent.write;
    let repromptText = '';
    let sessionAttributes = {};
    const shouldEndSession = false;
    let speechOutput = '';
    sessionAttributes = createActionAttributes(globalAction);
    var currentDate = new Date();
    var date = currentDate.getDate();
    var month = currentDate.getMonth(); //Be careful! January is 0 not 1
    var year = currentDate.getFullYear();
    var dateString = date + "-" +(month + 1) + "-" + year;
    var timeStamp = currentDate.getTime();
    var ID = "ID - " + timeStamp;
    var ddb = new AWS.DynamoDB({apiVersion: '2012-10-08'});
    AWS.config.update({region:'eu-west-1'});    
    var params = {
    TableName: 'Action',
    Item: {
        'timeStamp' : {S:ID},
        'action' : {S:globalAction},
    }
    };
    ddb.putItem(params, function(err,data){
        if (err){
            console.log(err);
        }else{
            console.log('Success!');
        }
    });
    speechOutput = `Noted`;
    callback(sessionAttributes, buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
}

// --------------- Events -----------------------

//Called when the session starts.
function onSessionStarted(sessionStartedRequest, session) {
    console.log(`onSessionStarted requestId=${sessionStartedRequest.requestId}, sessionId=${session.sessionId}`);
}

// Called when the user launches the skill without specifying what they want.

function onLaunch(launchRequest, session, callback) {
    console.log(`onLaunch requestId=${launchRequest.requestId}, sessionId=${session.sessionId}`);
    // Dispatch to your skill's launch.
    getWelcomeResponse(callback);
}

//Called when the user specifies an intent for this skill.

function onIntent(intentRequest, session, callback) {
    console.log(`onIntent requestId=${intentRequest.requestId}, sessionId=${session.sessionId}`);
    const intent = intentRequest.intent;
    const intentName = intentRequest.intent.name;
    // Dispatch to your skill's intent handlers
    if (intentName === 'MyActionIsIntent') {
        setActionInSession(intent, session, callback);
    } else if (intentName === 'AMAZON.HelpIntent') {
        getWelcomeResponse(callback);
    } else if (intentName === 'AMAZON.StopIntent' || intentName === 'AMAZON.CancelIntent') {
        handleSessionEndRequest(callback);
    } else {
        throw new Error('Invalid intent');
    }
}

//Called when the user ends the session. Is not called when the skill returns shouldEndSession=true.
function onSessionEnded(sessionEndedRequest, session) {
    console.log(`onSessionEnded requestId=${sessionEndedRequest.requestId}, sessionId=${session.sessionId}`);
// Add cleanup logic here
}

// --------------- Main handler -----------------------

// Route the incoming request based on type (LaunchRequest, IntentRequest, etc.) The JSON body of the request is provided in the event parameter.
exports.handler = (event, context, callback) => {
    try {
        console.log(`event.session.application.applicationId=${event.session.application.applicationId}`);
        if (event.session.new) {
            onSessionStarted({ requestId: event.request.requestId }, event.session);
        }
        if (event.request.type === 'LaunchRequest') {
            onLaunch(event.request,
                event.session,
                (sessionAttributes, speechletResponse) => {
                    callback(null, buildResponse(sessionAttributes, speechletResponse));
                });
        } else if (event.request.type === 'IntentRequest') {
            onIntent(event.request,
                event.session,
                (sessionAttributes, speechletResponse) => {
                    callback(null, buildResponse(sessionAttributes, speechletResponse));
                });
        } else if (event.request.type === 'SessionEndedRequest') {
            onSessionEnded(event.request, event.session);
            callback();
        }
    } catch (err) {
        callback(err);
    }
};

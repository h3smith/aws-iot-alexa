> **Warning**: this code is not pretty nor do I know if this is the proper way to do any of this. This was a project for me to learn Raspberry Pi, Lambda, and AWS IoT. I have no real plans to maintain this - it is more just a basic "how to" for implementing this since nothing out there exists to do it. 

The goal is, can we hook Alexa up and have it run a Raspberry Pi? The answer is yes.

We have two goals: Ask Alexa to open or close the garage door and query Alexa if the garage door is open. The Alexa trigger word is `Garage Door` to get into the garage door functionality. 

### Asking to open or close

This can be used with our without Alexa in the end. The basic workflow is:

* Ask Alexa: Open Garage
* Alexa triggers AWS Lambda function `pi-garage-ask`
* `pi-garage-ask` triggers the `pi-garage-open-lambda` AWS SNS topic
* The `pi-garage-open-lambda` SNS topic triggers the `toggle-garage-door` Lambda function
* The `toggle-garage-door` Lambda function sends a MQTT message to the AWS IoT device
* The AWS IoT device opens or closes the door

### Asking the state
* Ask Alexa: Is it open?
* Alexa triggers AWS Lambda function `pi-garage-ask`
`pi-garage-ask` sends back the open or closed state, very simple


## Setup AWS IoT

The NodeJS project on the Raspberry Pi acts as a dumb listener and does the work on the device. It leverages AWS IoT MQTT connections to read and write to AWS IoT. From here we can listen to events coming in and publish data to AWS. 

The way we have setup the NodeJS on the Pi, it will send the door state one a certain interval. Every few minutes, we will force the device state to recheck itself completely and resend it. From there, it will simply listen for open or close commands. 

Browse to [AWS IoT](https://console.aws.amazon.com/iot/home?region=us-east-1#) and select `Create a thing`. We'll call this `pi-garage` for the garage door opener. Once you create `View` and then `Connect Device`. Select `NodeJS` then `Generate Certificate and Policy`. Download and save the three locally to your device. 

These certs and keys will be used on your Pi to connect to AWS IoT and establish the MQTT connection for bidirectional communication. 

## Pi Code

`iot.js` is our Pi IoT/nodejs code. This is what we load into our Pi to open and close the garage door on the actual device. This has the connections to and from the AWS IoT with MQTT.

`iot.js` relies on a NPM project that isn't maintained anymore `pi-gpio.js` - we had to make some customizations to it. Mainly, the state would toggle the switch connected to the garage door and open it when `iot.js` started. This is bad, you don't want your garage opening when the PI rebooted!

**Note: this code is not pretty and needs to be cleaned up**

It is pretty self explanatory. 

## Setup Lambda function

### Toggle Garage Door

Lamba functions help drive the functionality with the Pi. We use them to send messages to the Pi (and optionally send alerts). 

Browse to [Lambda](https://console.aws.amazon.com/lambda/home?region=us-east-1#/functions?display=list) and select `Create Lambda Function`. Start with a blank function. Select Node.js as the invoking language and Upload as Zip. Name this function `toggle-garage-door`.

With Node.js locally on your machine, restore all the packages in the /toggle-garage-door folder. Zip the contents of the folder and upload it for this function. 

If you have already setup the SNS topic below, you can just link it through Lambda `Triggers` tab. You can also connect this function to an AWS IoT Button if you like. 

### Garage Door Ask

This Lambda function allows us to open the door from Alexa. 

Start with a blank Lambda function with NodeJS as the language and inline code.

Copy the `labmda/pi-garage-ask/code.js` code into this function. This code will allow us to ask Alexa "Is the garage door open?" or "Open the garage door."

You will need to copy the ARN for the `pi-garage-open-lambda` into the code where we define the SNS topic at the top of the file. 

Additionally you will need the ID for your AWS IoT device and set it in the `pi-garage-ask` Lambda function:

```
var iotdata = new aws.IotData({
  endpoint: '{IOT_ID}.iot.us-east-1.amazonaws.com',
  apiVersion: '2015-05-28'
});
```

##### Permissions

Create a new IAM role: `lambda_ask_garage` and assign it the policies:

iot_permissioms:
```
{
  "Version": "2012-10-17",
  "Statement": [
    {
        "Effect": "Allow",
        "Action": ["iot:Connect","iot:GetThingShadow"],
        "Resource": ["*"]
        }
  ]
}
```

send_sns (add any SNS permissions you want it to hit)
```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "sns:Publish"
            ],
            "Resource": [
                "arn:aws:sns:us-east-1:{account-id}:pi-garage-open-lambda"
            ]
        }
    ]
}
```

## Setup SNS Topics

SNS helps drive the events we are creating. We will create one and optionally two. 

The first is a necessity, we will call it `pi-garage-open-lambda` - this topic subscribes to our Lambda function that toggles the garage door (moves it up or down). 

Browse to [SNS Topics](https://console.aws.amazon.com/sns/v2/home?region=us-east-1#/topics) and select `Create a new topic` - give the topic a name `pi-garage-open-lambda.` Once created, `Create subscription` and add your Lambda function `toggle-garage-door` as the Endpoint.

## Adding in Alexa

Browse to [Alexa Developer Portal](https://developer.amazon.com/edw/home.html#) - note you may have to create an account. 

Go to `Alexa Skills Kit` and tap `Getting Started`. Add a new Skill call it `Raspberry Pi Garage`

When you get to configuration:


##### Interaction Model: 
```
{
  "intents": [
    {
      "intent": "ChangeDoorIntent",
      "slots": [
        {
          "name": "State",
          "type": "DOOR_STATES"
        }
      ]
    },
    {
      "intent": "DoorStateIntent"
    }
  ]
}
```

##### Custom Slot Types
```
Type Name:
DOOR_STATES 

Values:
open
close
```

##### Sample Utterances 
```
ChangeDoorIntent {State} the door
ChangeDoorIntent {State} the garage door
ChangeDoorIntent {State} the garage
ChangeDoorIntent {State} it
DoorStateIntent is the door up
DoorStateIntent is it up
DoorStateIntent is it open
DoorStateIntent is it closed
DoorStateIntent is the door down
DoorStateIntent is it down
DoorStateIntent is the door open
DoorStateIntent is the door closed
DoorStateIntent is the garage door up
DoorStateIntent is the garage door down
DoorStateIntent is the garage door open
DoorStateIntent is the garage door closed
DoorStateIntent is the garage open
DoorStateIntent is the garage closed
```



### Alexa Configuration

Select `AWS Lambda ARN (Amazon Resource Name)`

Enter the ARN for your `pi-garage-ask` Lambda function.

Account linking: No



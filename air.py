import os
import sys
import time
import logging
import json
import random
import threading
import math
import ev3dev.auto as ev3
from enum import Enum
from smbus2 import SMBus, i2c_msg
from agt import AlexaGadget
from ev3dev2.led import Leds
from ev3dev2.sound import Sound
from ev3dev2.sensor.lego import ColorSensor
from ev3dev2.sensor.lego import TouchSensor
from ev3dev2.motor import OUTPUT_A, SpeedPercent, MediumMotor

# Set the logging level to INFO to see messages from AlexaGadget
logging.basicConfig(level=logging.INFO, stream=sys.stdout, format='%(message)s')
logging.getLogger().addHandler(logging.StreamHandler(sys.stderr))
logger = logging.getLogger(__name__)

B = 42500 # B value of the thermistor
R0 = 100000 # R0 = 100000

class EventName(Enum):
    """
    The list of custom event name sent from this gadget
    """
    FANSPEED = "FanSpeed"
    AIRQUALITY = "AirQuality"
    FILTER = "Filter"
    TEMPERATURE = "Temperature"

class MindstormsGadget(AlexaGadget):
    """
    A Mindstorms gadget that can perform bi-directional interaction with an Alexa skill.
    """

    def __init__(self):
        """
        Performs Alexa Gadget initialization routines and ev3dev resource allocation.
        """
        super().__init__()
    
        # the default I2C address of the sensor
        self.I2C_ADDRESS = 0x21  
        
        # setup the buses
        self.airqualitybus = SMBus(3)
        self.temperaturebus = SMBus(4)

        #setup the moisbus and relaybus
        self.airqualitybus.write_byte_data(self.I2C_ADDRESS, 0x42, 0x01)
        self.temperaturebus.write_byte_data(self.I2C_ADDRESS, 0x42, 0x01)

        #setup the lastmois so we can track it well
        self.lastairquality = 0
        self.lasttemperature = 0
        self.count = 0
        self.speed = 0

        # Robot state
        self.auto_mode = False
        self.filterwarning = False

        self.sound = Sound()
        self.leds = Leds()
        self.color = ColorSensor()
        self.touch = TouchSensor()

        #Motor
        self.fan = MediumMotor(OUTPUT_A)

        #screen
        self.screen = ev3.Screen()

        # Start threads
        threading.Thread(target=self._autofan_thread, daemon=True).start()
        threading.Thread(target=self._manual_button_thread, daemon=True).start()

    def on_connected(self, device_addr):
        """
        Gadget connected to the paired Echo device.
        :param device_addr: the address of the device we connected to
        """
        self.leds.set_color("LEFT", "GREEN")
        self.leds.set_color("RIGHT", "GREEN")
        logger.info("{} connected to Echo device".format(self.friendly_name))

    def on_disconnected(self, device_addr):
        """
        Gadget disconnected from the paired Echo device.
        :param device_addr: the address of the device we disconnected from
        """
        self.leds.set_color("LEFT", "BLACK")
        self.leds.set_color("RIGHT", "BLACK")
        logger.info("{} disconnected from Echo device".format(self.friendly_name))

    def on_custom_mindstorms_gadget_control(self, directive):
        """
        Handles the Custom.Mindstorms.Gadget control directive.
        :param directive: the custom directive with the matching namespace and name
        """
        try:
            payload = json.loads(directive.payload.decode("utf-8"))
            print("Control payload: {}".format(payload), file=sys.stderr)
            control_type = payload["type"]
            if control_type == "airquality":
                self._airquality_handler()
            elif control_type == "temperature":
                self._temperature_handler(payload["unit"])
            elif control_type == "speed":
                self._speed_handler(payload["speed"])
            elif control_type == "auto":
                self._auto_handler(payload["command"])
        except KeyError:
            print("Missing expected parameters: {}".format(directive), file=sys.stderr)
    
    def _speed_handler(self, speed):        
        print(speed)
        self.speed = speed
        if speed != 0:
            self.fan.on(SpeedPercent(-speed))
        else:
            self.fan.on(SpeedPercent(speed))  
            self.fan.off()

    def _airquality_handler(self):
        print(self.lastairquality)
        if self.lastairquality > 700:
            if self.auto_mode == True:
                self._send_event(EventName.AIRQUALITY, {'request': 0, 'speech': "We are currently experiencing high pollution, air filter is set to high automatically"})
            else:
                self._send_event(EventName.AIRQUALITY, {'request': 1, 'speech': "We are currently experiencing high pollution, would you like to set the air purifier to high mode?"})
        elif self.lastairquality > 300:
            if self.auto_mode == True:
                self._send_event(EventName.AIRQUALITY, {'request': 0, 'speech': "We are currently experiencing low pollution, air filter is set to high automatically"})
            else:
                self._send_event(EventName.AIRQUALITY, {'request': 1, 'speech': "We are currently experiencing low pollution, would you like to set the air purifier to high mode?"})
        else:
            self._send_event(EventName.AIRQUALITY, {'request': 0, 'speech': "The air quality is fresh and clean."})

    def _temperature_handler(self, unit):
        print(self.lasttemperature)
        if unit.lower() == 'fahrenheit':
            fahrenheit = self.lasttemperature * 9/5 + 32
            print(fahrenheit)
            self._send_event(EventName.TEMPERATURE, {'speech': "The temperature in the room is " + str(int(fahrenheit)) + " degrees fahrenheit"})
        else:
            self._send_event(EventName.TEMPERATURE, {'speech': "The temperature in the room is " + str(int(self.lasttemperature)) + " degrees celcius"})

    def _auto_handler(self, onoff):
        if onoff == "on":
            self.auto_mode = True
        else:
            self.auto_mode = False

    def _send_event(self, name: EventName, payload):
        """
        Sends a custom event to trigger a sentry action.
        :param name: the name of the custom event
        :param payload: the sentry JSON payload
        """
        print(name.value)
        print(payload)
        self.send_custom_event('Custom.Mindstorms.Gadget', name.value, payload)

    def _autofan_thread(self):
        """
        Performs random movement when patrol mode is activated.
        """
        print('fan thread started')
        while True:
            self.screen.clear()
            #Air Quality
            self.screen.draw.rectangle((0,0,177,40), fill='black')
            
            part1 = self.airqualitybus.read_byte_data(self.I2C_ADDRESS, 0x44)
            part2 = self.airqualitybus.read_byte_data(self.I2C_ADDRESS, 0x45)
            aq = (part1 << 2) + part2
            print("Air Quality:" + str(aq))
            self.screen.draw.text((36,13), "Air Quality:" + str(aq), fill='white')

            
            #temperature
            part3 = self.temperaturebus.read_byte_data(self.I2C_ADDRESS, 0x44)
            part4 = self.temperaturebus.read_byte_data(self.I2C_ADDRESS, 0x45)
            temp = (part3 << 2) + part4
            R = 1023.0/temp-1.0
            R = R0*R
            temperature = 1.0/(math.log(R/R0)/B+1/298.15)-273.15
            print("Temperature:" + str(temperature))

            self.screen.draw.text((36,60),"Temperature:" + str(int(temperature)) +  " C")


            print("color:" + self.color.color_name)
            self.screen.draw.text((36,90),"Filter:" + self.color.color_name)
            
            self.screen.update()

            
            if self.auto_mode and aq >= 300 and self.lastairquality < 300:
                #got dirty
                self._speed_handler(100)
                self._send_event(EventName.FANSPEED, {'speech':'Pollution detected, auto setting fan speed to high'})

            elif self.auto_mode and aq <= 300 and self.lastairquality > 300:
                #got clean
                self._speed_handler(25)
                self._send_event(EventName.FANSPEED,  {'speech':'Air is clean now, auto setting fan speed to low'})
            
            if aq >= 700:
                gadget.leds.set_color("LEFT", "RED")
            elif aq >= 300:
                gadget.leds.set_color("LEFT", "YELLOW")
            else:
                gadget.leds.set_color("LEFT", "GREEN")
            
                    
            self.lastairquality = aq
            self.lasttemperature = temperature

            #Filter maintenance
            if self.color.color == ColorSensor.COLOR_WHITE or self.color.color == ColorSensor.COLOR_YELLOW:
                self.filterwarning = False
                gadget.leds.set_color("RIGHT", "GREEN")
            else:
                #reset
                gadget.leds.set_color("RIGHT", "YELLOW")
                if self.filterwarning == False:
                    self._send_event(EventName.FILTER, {'speech':'The filter seems dirty, please check it and see if it needs to be replaced'})
                    self.filterwarning = True
            time.sleep(1)

    def _manual_button_thread(self):
        pressed = False
        while True:
            if self.touch.is_pressed == True:
                pressed = True
            if pressed == True and self.touch.is_released == True:
                #confirming pressed the button once
                pressed = False
                if self.speed == 0:
                    #it's currently off
                    self._speed_handler(25)
                    self._send_event(EventName.FANSPEED,  {'speech':'Air purifier is setted to low manually'})
                elif self.speed < 60:
                    self._speed_handler(60)
                    self._send_event(EventName.FANSPEED,  {'speech':'Air purifier is setted to medium manually'})
                elif self.speed < 100:
                    self._speed_handler(100)
                    self._send_event(EventName.FANSPEED,  {'speech':'Air purifier is setted to high manually'})
                else:
                    self._speed_handler(0)
                    self._send_event(EventName.FANSPEED,  {'speech':'Air purifier is turned off manually'})
        time.sleep(0.1)

if __name__ == '__main__':

    gadget = MindstormsGadget()

    # Set LCD font and turn off blinking LEDs
    os.system('setfont Lat7-Terminus12x6')
    gadget.leds.set_color("LEFT", "BLACK")
    gadget.leds.set_color("RIGHT", "BLACK")

    # Startup sequence
    gadget.sound.play_song((('C4', 'e'), ('D4', 'e'), ('E5', 'q')))
    gadget.leds.set_color("LEFT", "GREEN")
    gadget.leds.set_color("RIGHT", "GREEN")

    # Gadget main entry point
    gadget.main()

    # Shutdown sequence
    gadget.sound.play_song((('E5', 'e'), ('C4', 'e')))
    gadget.leds.set_color("LEFT", "BLACK")
    gadget.leds.set_color("RIGHT", "BLACK")


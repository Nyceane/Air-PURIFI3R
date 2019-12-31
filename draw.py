#!/usr/bin/env python3
from ev3dev.ev3 import *
from time import sleep

lcd = Screen()
lcd.draw.rectangle((0,0,177,40), fill='black')
lcd.draw.text((48,13),'Hello, world.', fill='white')
lcd.draw.text((36,80),'THIS TEXT IS BLACK')
lcd.update()
sleep(6)
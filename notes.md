
# Run on startup on Pi

To have the `iot.js` file run on startup of the Pi you'll need to make some configuration changes on the Pi.

Edit the `rc.local` file with the command `sudo nano /etc/rc.local`

Add the command

`sudo node /home/pi/{project_path}/iot.js < /dev/null &`

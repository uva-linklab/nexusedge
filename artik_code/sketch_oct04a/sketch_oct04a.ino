int pin = 38;

void setup() {
  // put your setup code here, to run once:
  // initialize digital pin 13 as an output.
  pinMode(pin, OUTPUT);
//  SERIAL_ARTIK.begin(115200);
}

void loop() {
  // put your main code here, to run repeatedly:
//  SERIAL_ARTIK.println("Turn on LED");
  digitalWrite(pin, HIGH); // turn the LED on (HIGH is the voltage level)
  delay(1000); // wait for a second
//  SERIAL_ARTIK.println("Turn off LED");
  digitalWrite(pin, LOW); // turn the LED off by making the voltage LOW
  delay(1000); // wait for a second
}

import type { Bi } from "./types";

/**
 * Prewritten demo lessons. Each question is [skill, prompt, options, explanation] and the
 * FIRST option is the correct one; options are shuffled deterministically when quizzes are built.
 */
export type RawQuestion = [skill: string, prompt: string, options: [string, string, string, string], explanation: string];
export type RawDifficulty = "easy" | "medium" | "hard";
/** Extra bank question with an explicit difficulty (first option is correct). */
export type RawBankQuestion = [...RawQuestion, RawDifficulty];

export interface RawStage {
  id: string;
  /** Difficulty of each question in quizzes A and B: one letter per question, e/m/h. */
  difficulty: [string, string];
  /** More questions for the skill-tagged bank, so adaptive quizzes don't repeat. */
  extra: RawBankQuestion[];
  title: Bi;
  goal: string;
  explanation: string;
  parts: string[];
  mentor: { alternative: string; practiceTask: string };
  quizzes: [RawQuestion[], RawQuestion[]];
}

export const basicsStage: RawStage = {
  id: "basics",
  difficulty: ["ememe", "eemee"],
  extra: [
    ["Resistors", "An LED circuit works but the LED is very dim. The resistor is 10 kΩ. What's the likely fix?", ["Use a smaller value such as 220 Ω", "Use a 100 kΩ resistor", "Remove GND", "Use an analog pin"], "A large resistor lets very little current through; 220 Ω gives typical brightness.", "hard"],
    ["Closed circuits", "Which path makes a complete circuit for an LED?", ["5V → resistor → LED anode → LED cathode → GND", "5V → LED anode only", "GND → GND", "5V → 5V"], "Current must leave the supply, pass through the parts and return to GND.", "medium"],
    ["Voltage", "The Uno has 5V and 3V3 pins. Which statement is right?", ["They supply different voltages; use the one your part is rated for", "They are the same pin", "3V3 is always stronger", "5V is only an input"], "Pick the supply that matches the part's rating.", "medium"],
    ["Current", "Why does a resistor reduce an LED's current?", ["It opposes the flow, so less current flows for the same voltage", "It stores current", "It adds voltage", "It turns current into light"], "Ohm's law: I = V ÷ R.", "hard"],
  ],
  title: { en: "Electricity basics", ar: "أساسيات الكهرباء" },
  goal: "Understand voltage, current, ground, and how a breadboard and controller pins complete a circuit.",
  explanation:
    "Voltage is the electrical 'push' between two points, measured in volts (V). Current is how much charge flows, measured in amperes (small parts use milliamps, mA). Current only flows around a closed loop: from the supply, through the parts, and back to ground (GND, 0 V). A breadboard connects its holes in short rows of five, plus long power rails, so you can build without soldering. A controller such as the Arduino Uno has digital pins (HIGH = 5 V or LOW = 0 V), analog inputs A0–A5 that read a voltage, and power pins 5V, 3V3 and GND.",
  parts: ["arduino_uno", "resistor_220", "led_red"],
  mentor: {
    alternative:
      "Think of water in a pipe. Voltage is the water pressure, current is how much water flows, and a resistor is a narrow section that slows it down. Ground is the drain the water returns to. With no drain, nothing flows — that's why every circuit must come back to GND.",
    practiceTask:
      "In the 3D Lab, wire Arduino 5V → 220 Ω resistor → red LED anode, then LED cathode → GND, and run Validate Wiring.",
  },
  quizzes: [
    [
      ["Voltage", "What does voltage describe?", ["The electrical 'push' between two points", "How much charge flows each second", "The resistance of a wire", "The number of pins on a board"], "Voltage is the push (potential difference); current is the flow it causes."],
      ["Closed circuits", "An LED's anode is connected to 5V but nothing else. Why doesn't it light?", ["There's no return path to ground, so no current flows", "The LED needs a faster controller", "5 V is too low for any LED", "The anode must go to an analog pin"], "Current needs a complete loop back to GND."],
      ["Ground", "What is GND?", ["The 0 V reference that current returns to", "A pin that always outputs 5 V", "A wireless antenna", "A spare pin you can ignore"], "GND is the common 0 V reference for the whole circuit."],
      ["Breadboards", "On a breadboard, which holes are connected to each other?", ["Holes in the same short row of five, and along each long power rail", "Every hole on the board", "Only holes of the same colour", "None; you must solder them"], "Each short row of five is one connection; the long rails carry power and ground."],
      ["Controller pins", "Which Arduino Uno pins read a varying voltage such as a sensor level?", ["The analog inputs A0–A5", "D0 and D1", "VIN only", "RESET"], "A0–A5 convert a voltage into a number from 0 to 1023."],
    ],
    [
      ["Current", "Current is measured in…", ["amperes (A), or milliamps (mA) for small parts", "volts (V)", "ohms (Ω)", "hertz (Hz)"], "Amperes measure flow; volts measure push; ohms measure resistance."],
      ["Resistors", "Why put a resistor in series with an LED?", ["To limit the current so the LED and the pin aren't damaged", "To make the LED blink", "To raise the voltage", "To connect it wirelessly"], "Without a resistor an LED can draw too much current."],
      ["Ground", "A sensor module sends a signal to the Arduino. What must they also share?", ["A common ground (GND)", "The same USB cable", "The same wire colour", "Nothing else"], "Signals are measured relative to ground, so both sides need the same GND."],
      ["Closed circuits", "A circuit is 'closed' when…", ["there's a complete loop from the supply through the parts back to ground", "a switch is turned off", "all the wires are red", "the board is in a case"], "A closed loop lets current flow; an open one stops it."],
      ["Controller pins", "A digital output pin on the Uno can be set to…", ["HIGH (5 V) or LOW (0 V)", "any voltage from 0 to 12 V", "only 3.3 V", "analog input only"], "Digital pins have two states: HIGH or LOW."],
    ],
  ],
};

export const irrigationStages: RawStage[] = [
  {
    id: "irrigation-sensor",
    difficulty: ["eemme", "ehmmm"],
    extra: [
      ["ADC range", "A reading of about 512 on the Uno means the input is roughly…", ["2.5 V, half of 5 V", "5 V", "0 V", "12 V"], "512 is about half of 1023.", "hard"],
      ["Powering sensors", "Which wire carries the moisture signal to the Arduino?", ["AO to A0", "VCC to 5V", "GND to GND", "DO to RESET"], "AO carries the analog signal; VCC and GND are power.", "easy"],
      ["Digital output", "If you use DO instead of AO, what do you lose?", ["The full moisture range; you only get dry or wet", "Nothing", "The power supply", "The ground"], "DO is only HIGH or LOW at the set threshold.", "hard"],
      ["Analog input", "Which function reads the sensor on A0?", ["analogRead(A0)", "digitalWrite(A0)", "pulseIn(A0)", "tone(A0)"], "analogRead returns 0–1023 for an analog input.", "easy"],
    ],
    title: { en: "Reading soil moisture", ar: "قراءة رطوبة التربة" },
    goal: "Read the soil moisture sensor with an analog pin and understand what the numbers mean.",
    explanation:
      "The soil moisture probe's resistance changes with how wet the soil is. The module turns that into a voltage on AO (analog output), which the Arduino reads on an analog pin such as A0 as a number from 0 to 1023. Many modules also have DO (digital output), which switches HIGH or LOW at a threshold set by the module's small potentiometer. Power the module from 5V and GND. Dry and wet readings differ between modules, so measure both and write them down before choosing a threshold.",
    parts: ["soil_moisture", "arduino_uno"],
    mentor: {
      alternative:
        "Treat the sensor like a thermometer for water: analogRead turns its voltage into a score from 0 to 1023. You don't need to know the 'dry' number in advance — you test it once in dry soil and once in a glass of water, then pick a value in between.",
      practiceTask:
        "In the 3D Lab, connect the soil moisture module VCC → 5V, GND → GND and AO → A0, then run Validate Wiring.",
    },
    quizzes: [
      [
        ["Analog input", "Which Arduino pin type reads the sensor's AO output as a range of values?", ["An analog input such as A0", "A digital pin such as D2", "The 3V3 pin", "The RESET pin"], "AO is an analog voltage; A0–A5 convert it to 0–1023."],
        ["ADC range", "On the Uno, analogRead returns numbers in which range?", ["0–1023", "0–1", "0–255", "0–5000"], "The Uno's analog-to-digital converter has 10 bits: 0 to 1023."],
        ["Calibration", "How should you choose the 'dry' threshold?", ["Measure readings in dry and wet soil and pick a value between them", "Use 512 for every sensor", "Copy any value from the internet", "Use the pin number"], "Each sensor and soil differs, so calibrate with real readings."],
        ["Digital output", "What does the module's DO pin give you?", ["A HIGH/LOW signal switched at a threshold set by the module's potentiometer", "Mains power", "The exact moisture in percent", "Serial data"], "DO is a simple on/off comparison; AO gives the full range."],
        ["Powering sensors", "How is the module powered in this project?", ["VCC to 5V and GND to GND", "VCC to A0", "Only GND is needed", "From the pump"], "Power pins go to 5V and GND; the signal goes to A0."],
      ],
      [
        ["Analog input", "What does AO stand for on the module?", ["Analog output: a voltage that changes with moisture", "Always on", "Arduino only", "Auto off"], "AO carries the analog moisture signal."],
        ["Calibration", "Your sensor reads 820 in dry soil and 350 in water. Which threshold is sensible for 'dry'?", ["About 600", "100", "1023", "0"], "A value between the wet and dry readings separates the two states."],
        ["ADC range", "If analogRead returns 1023, the input voltage is about…", ["the reference voltage, 5 V on the Uno", "0 V", "2.5 V", "12 V"], "1023 is the top of the range, at the reference voltage."],
        ["Digital output", "To change the switching point of DO, you…", ["turn the small potentiometer on the module", "rewire GND", "change the USB cable", "can't change it"], "The potentiometer sets the comparator threshold."],
        ["Calibration", "Why do two moisture modules give different readings in the same soil?", ["Modules and probes vary, so each needs its own dry/wet measurement", "They never differ", "Because of the LED colour", "Because of the cable colour"], "Calibrate each sensor you use."],
      ],
    ],
  },
  {
    id: "irrigation-relay",
    difficulty: ["eemeh", "emmee"],
    extra: [
      ["Relay contacts", "With the pump on COM and NC instead of NO, what happens?", ["The pump runs while the relay is off", "The pump never runs", "Nothing changes", "The relay overheats"], "NC is closed while the relay is off.", "hard"],
      ["Active LOW", "An active-LOW relay should stay off at start-up. What should setup() write to IN?", ["HIGH", "LOW", "Nothing", "analogRead"], "For active-LOW modules, HIGH means off.", "hard"],
      ["Control signal", "Which function switches the relay from the Arduino?", ["digitalWrite on the IN pin", "analogRead on COM", "pulseIn on NO", "tone on NC"], "IN is driven like any digital output.", "easy"],
      ["Current limits", "The pump needs far more current than D7 can give. Which part solves this here?", ["The relay module", "A 220 Ω resistor", "The LCD", "The soil sensor"], "The relay switches the pump's own supply.", "medium"],
    ],
    title: { en: "Switching the pump with a relay", ar: "تشغيل المضخة عبر الريليه" },
    goal: "Use a relay so a controller pin can switch the pump safely.",
    explanation:
      "An Arduino pin can supply only a small current — far too little for a pump motor. A relay module is an electrically controlled switch: a small signal on its IN pin energises a coil, which closes contacts that carry the pump's current from a suitable supply. Wire the module's VCC and GND to the controller, IN to a digital pin, and put the pump in series with the relay's COM and NO (normally open) contacts, so the pump runs only while the relay is on. Many relay modules are active LOW, meaning LOW turns them on — check your module. Disconnect power before changing the wiring.",
    parts: ["relay_5v", "water_pump_5v"],
    mentor: {
      alternative:
        "A relay is like asking a strong friend to flip a heavy switch for you. The Arduino only whispers 'now' on IN; the relay's contacts do the heavy lifting for the pump.",
      practiceTask:
        "In the 3D Lab, place the relay: VCC → 5V, GND → GND, IN → D7. Add the pump and run Validate Wiring to check power and ground.",
    },
    quizzes: [
      [
        ["Current limits", "Why not power the pump directly from an Arduino pin?", ["The pin's current is far too small for a motor, and the pin can be damaged", "Pumps only work at night", "The pin is analog", "It would make the pump too fast"], "Motors need much more current than a GPIO pin can safely supply."],
        ["Relay basics", "What does the relay do?", ["Acts as a switch controlled by a small signal", "Measures moisture", "Stores water", "Converts 5 V to 3.3 V"], "A small signal on IN switches a separate, higher-current circuit."],
        ["Relay contacts", "Which contacts make the pump run only while the relay is energised?", ["COM and NO (normally open)", "COM and NC (normally closed)", "VCC and GND", "IN and GND"], "NO is open when the relay is off and closes when it turns on."],
        ["Control signal", "Which relay pin connects to an Arduino digital pin?", ["IN", "COM", "NO", "NC"], "IN is the control input; COM/NO/NC are the switch contacts."],
        ["Active LOW", "Your relay turns on when you write LOW. This module is…", ["active LOW, which is common for relay modules", "broken", "analog", "wireless"], "Many relay boards invert the control signal."],
      ],
      [
        ["Relay basics", "The small signal on IN controls…", ["the relay coil, which moves the switch contacts", "the soil sensor", "the USB port", "the LCD contrast"], "IN energises the coil; the coil moves the contacts."],
        ["Relay contacts", "'Normally open' means the contacts are…", ["open (not connected) while the relay is off", "closed while the relay is off", "always connected", "only for AC"], "NO closes only when the relay is energised."],
        ["Current limits", "Where should the pump's current come from?", ["A suitable power supply, switched through the relay contacts", "The A0 pin", "The RESET pin", "The LCD"], "The relay switches the pump's own supply."],
        ["Ground", "The relay module's GND should connect to…", ["the controller's GND", "nothing", "the pump's water", "A0"], "The control side shares ground with the controller."],
        ["Wiring safety", "Before changing relay wiring you should…", ["disconnect power", "leave the pump supply connected", "add more water", "press RESET"], "Never rewire a powered circuit."],
      ],
    ],
  },
  {
    id: "irrigation-logic",
    difficulty: ["memme", "heeeh"],
    extra: [
      ["Hysteresis", "With a single threshold of 600, what happens when the reading hovers around 600?", ["The pump switches on and off rapidly", "The pump stays off", "The LCD turns off", "Nothing"], "That's why two thresholds are used.", "medium"],
      ["I²C wiring", "On the LCD module, which pins carry I²C?", ["SDA and SCL", "VCC and GND", "AO and DO", "COM and NO"], "VCC and GND are power; SDA and SCL are data and clock.", "easy"],
      ["Program loop", "Why update the LCD after switching the relay?", ["So the display shows the current pump state", "The relay needs the LCD", "To read the sensor", "I²C requires it"], "Show what the system just did.", "medium"],
      ["Fail-safe logic", "Which pair is a sensible fail-safe design?", ["Hysteresis plus a maximum watering time", "One threshold and no limit", "No sensor", "Watering every second"], "Thresholds prevent chatter; a time limit covers sensor failure.", "hard"],
    ],
    title: { en: "Watering logic and display", ar: "منطق الري والعرض" },
    goal: "Combine the sensor, relay and LCD: water only when the soil is dry, and show the reading.",
    explanation:
      "The program loops: read the sensor, compare with your thresholds, switch the relay, and update the LCD. Use two thresholds (hysteresis) — for example start watering above 650 (dry) and stop below 500 (wet) — so the pump doesn't click on and off around a single value. The I²C LCD needs only four wires: VCC, GND, SDA (A4 on the Uno) and SCL (A5). Its I²C address is often 0x27 or 0x3F; an I²C scanner sketch finds it. Add a maximum watering time too, so a failed sensor can't flood the pot.",
    parts: ["lcd1602_i2c", "arduino_uno"],
    mentor: {
      alternative:
        "Think of a home thermostat: it doesn't switch the heater at exactly 21 °C over and over; it turns on below 20 and off above 22. Your irrigation uses the same trick with moisture readings, and a kitchen timer as a safety net.",
      practiceTask:
        "In the 3D Lab, connect the LCD: VCC → 5V, GND → GND, SDA → A4, SCL → A5, then run Validate Wiring.",
    },
    quizzes: [
      [
        ["Hysteresis", "Why use two thresholds (start and stop) for the pump?", ["To prevent rapid on/off switching around one value", "To use more pins", "Because the LCD needs it", "To make the pump louder"], "A gap between start and stop keeps the relay from chattering."],
        ["I²C wiring", "Which Uno pins carry I²C to the LCD?", ["A4 (SDA) and A5 (SCL)", "D0 and D1", "D9 and D10", "VIN and RESET"], "On the Uno, SDA is A4 and SCL is A5."],
        ["I²C address", "The LCD shows nothing although the wiring is right. A likely cause is…", ["the wrong I²C address in the code, e.g. 0x27 instead of 0x3F", "too much water", "the relay is normally open", "the sensor is analog"], "Run an I²C scanner and use the address it reports."],
        ["Fail-safe logic", "Why add a maximum watering time?", ["So a failed sensor can't keep the pump running forever", "To save LCD power", "To speed up analogRead", "I²C requires it"], "A time limit protects the plant if the sensor fails."],
        ["Program loop", "What's the right order in each loop?", ["Read sensor → compare → switch relay → show reading", "Update the LCD, then never read", "Switch the relay randomly", "Read the LCD to get moisture"], "Sense, decide, act, then report."],
      ],
      [
        ["Hysteresis", "Start above 650, stop below 500 (higher = drier). The reading is 580 and the pump is on. What happens?", ["The pump stays on until the reading drops below 500", "It turns off immediately", "It turns on twice", "The LCD resets"], "Between the thresholds, the pump keeps its current state."],
        ["I²C wiring", "How many signal wires does I²C use, besides power?", ["Two: SDA and SCL", "One", "Eight", "Sixteen"], "I²C uses a data line and a clock line."],
        ["I²C address", "How can you find the LCD's I²C address?", ["Run an I²C scanner sketch", "Measure it with a ruler", "It's always 0x00", "Read it from the relay"], "The scanner lists every responding address."],
        ["Display", "What's useful to show on the LCD?", ["The current moisture reading and whether the pump is on", "Nothing", "Only the time", "The Wi-Fi password"], "Show what the system measures and does."],
        ["Fail-safe logic", "The sensor wire breaks and reads 'dry' forever. Which feature protects the plant?", ["A maximum watering time", "A brighter LCD", "A second LCD", "Hysteresis alone"], "Hysteresis can't help if the reading is wrong; a time limit can."],
      ],
    ],
  },
];

export const trafficStages: RawStage[] = [
  {
    id: "traffic-leds",
    difficulty: ["eehme", "emmhm"],
    extra: [
      ["Ohm's law", "A green LED drops about 2.4 V. With a 5 V pin and 220 Ω, the current is about…", ["12 mA", "1.2 mA", "120 mA", "24 mA"], "(5 − 2.4) ÷ 220 ≈ 0.012 A.", "hard"],
      ["Current limiting", "Where does the resistor go in an LED circuit?", ["In series with the LED, on either side", "In parallel across the board", "Only on the Uno's GND pin", "Nowhere"], "In series, it limits the LED current.", "medium"],
      ["Colour mixing", "Which RGB channels make amber in this project?", ["Red and green", "Blue only", "Red and blue", "Green and blue"], "Red plus green looks amber/yellow.", "easy"],
      ["LED polarity", "Which LED leg is usually longer?", ["The anode (+)", "The cathode (−)", "Both are equal", "It depends on the colour"], "The longer leg is normally the anode.", "easy"],
    ],
    title: { en: "LEDs and resistors", ar: "الصمامات والمقاومات" },
    goal: "Connect LEDs the right way round, with a correctly sized current-limiting resistor.",
    explanation:
      "An LED lets current flow only one way: from the anode (+, usually the longer leg) to the cathode (−, shorter leg, flat edge on the rim). It needs a series resistor to limit the current. With a 5 V pin and a red LED of about 2 V, R = (5 − 2) ÷ 0.015 A ≈ 200 Ω, so a 220 Ω resistor gives about 14 mA — bright and safe. The catalog has no yellow LED, so this project uses the RGB LED with its red and green channels on together to make amber; each channel needs its own resistor.",
    parts: ["led_red", "led_green", "led_rgb", "resistor_220"],
    mentor: {
      alternative:
        "An LED is a one-way door for electricity, and the resistor is the doorman who only lets a safe number through at a time. Put the door in backwards and nobody gets in — the LED stays dark, but it isn't broken.",
      practiceTask:
        "In the 3D Lab, wire D9 → 220 Ω resistor → red LED anode, and the cathode → GND, then run Validate Wiring.",
    },
    quizzes: [
      [
        ["LED polarity", "Which LED leg connects toward the positive side?", ["The anode (usually the longer leg)", "The cathode (shorter leg)", "Either; LEDs have no polarity", "Neither"], "Current flows from anode to cathode."],
        ["Current limiting", "What can happen without a series resistor on a 5 V pin?", ["Too much current can damage the LED and the pin", "The LED gets dimmer", "Nothing", "The LED changes colour"], "The resistor sets a safe current."],
        ["Ohm's law", "5 V supply, 2 V LED, 15 mA target: the resistor is about…", ["200 Ω", "20 Ω", "2,000 Ω", "20,000 Ω"], "(5 − 2) ÷ 0.015 = 200 Ω."],
        ["LED polarity", "An LED stays dark. One likely cause is…", ["it's inserted backwards", "the resistor is 220 Ω", "the board has a USB port", "the wire is green"], "A reversed LED blocks the current."],
        ["Colour mixing", "How does this project show amber?", ["The RGB LED with its red and green channels on", "A yellow LED from the catalog", "A brighter red LED", "The LCD"], "Red plus green light looks amber/yellow."],
      ],
      [
        ["LED polarity", "The flat edge on an LED's rim marks the…", ["cathode", "anode", "resistor", "ground rail"], "The flat side is the cathode (−)."],
        ["Ohm's law", "Which formula sizes the LED resistor?", ["R = (Vsupply − Vled) ÷ I", "R = V × I", "R = I ÷ V", "R = Vsupply + Vled"], "The resistor drops the voltage the LED doesn't use."],
        ["Current limiting", "Each LED, and each RGB channel, needs…", ["its own current-limiting resistor", "no resistor", "one resistor shared by all", "a relay"], "Shared resistors give uneven brightness."],
        ["Ohm's law", "A 220 Ω resistor with 3 V across it passes about…", ["14 mA", "1.4 mA", "140 mA", "1.4 A"], "3 ÷ 220 ≈ 0.0136 A."],
        ["LED polarity", "If you reverse an LED in a 5 V circuit with a resistor…", ["it simply doesn't light", "it lights brighter", "it becomes a sensor", "the Arduino turns off"], "Reversed, it blocks current."],
      ],
    ],
  },
  {
    id: "traffic-timing",
    difficulty: ["eeemm", "emehm"],
    extra: [
      ["State machines", "What does a traffic-light state machine need to remember?", ["The current state and when it started", "Only the LED colour code", "The USB speed", "Nothing"], "The state and its start time decide the next change.", "medium"],
      ["Non-blocking timing", "millis() returns…", ["the milliseconds since the board started", "the current date", "the LED brightness", "a sensor reading"], "Compare it with a saved time to measure elapsed time.", "easy"],
      ["Light sequence", "After amber, the next state is…", ["red", "green", "amber again", "all off"], "Green → amber → red.", "easy"],
      ["State machines", "To add a pedestrian phase, the cleanest change is to…", ["add a new state with its own duration and transitions", "add more delay() calls", "remove the amber state", "use an analog pin"], "State machines grow by adding states and transitions.", "hard"],
    ],
    title: { en: "Timing the light sequence", ar: "توقيت تسلسل الإشارة" },
    goal: "Drive several outputs in a timed sequence without freezing the program.",
    explanation:
      "Each light gets its own digital pin, set as an OUTPUT in setup(). Writing HIGH turns it on and LOW turns it off. A traffic light is a sequence of states: red (e.g. 5 s), green (5 s), amber (2 s), then red again. You can write it with delay(), but delay() freezes the board, so it can't react to a button. Checking millis() — how much time has passed since the last change — keeps the timing while the program still reads inputs. Tracking the current state and changing it when its time is up is called a state machine.",
    parts: ["arduino_uno", "led_rgb", "led_red", "led_green"],
    mentor: {
      alternative:
        "Picture a cooking timer you glance at instead of standing frozen in front of the oven. delay() is standing frozen; millis() is checking the clock between other jobs.",
      practiceTask:
        "In the 3D Lab, connect the red LED to D9, the green LED to D10 and the RGB LED's R and G pins to D5 and D6, each through a 220 Ω resistor, then validate.",
    },
    quizzes: [
      [
        ["Digital outputs", "What must you do in setup() before driving an LED pin?", ["pinMode(pin, OUTPUT)", "analogRead(pin)", "Serial.end()", "pinMode(pin, INPUT)"], "A pin must be an output to drive an LED."],
        ["Digital outputs", "digitalWrite(9, HIGH) on the Uno puts about what voltage on D9?", ["5 V", "0 V", "3.3 V", "12 V"], "HIGH on the Uno is about 5 V."],
        ["Light sequence", "Which order matches this project's cycle?", ["Red → green → amber → red", "Green → red → green", "Amber only", "All on together"], "Amber is the short warning before red."],
        ["Non-blocking timing", "Why is millis() better than delay() here?", ["The board keeps running other code, like reading a button, while timing", "millis() makes LEDs brighter", "delay() doesn't exist", "millis() uses fewer wires"], "delay() blocks everything else."],
        ["State machines", "A 'state machine' means…", ["the program tracks its current state and changes it when a condition, like time, is met", "a machine that prints states", "a type of resistor", "an LCD mode"], "States plus transitions make the sequence easy to extend."],
      ],
      [
        ["Digital outputs", "digitalWrite(10, LOW) does what to an LED on D10 (wired to GND through a resistor)?", ["Turns it off", "Turns it on", "Makes it blink", "Changes its colour"], "LOW is 0 V, so no current flows."],
        ["Non-blocking timing", "During delay(5000), the Uno…", ["waits and can't run other code", "reads every button", "speeds up", "turns off the LEDs"], "delay() pauses the whole program."],
        ["Light sequence", "When is amber shown?", ["Briefly, as a warning before red", "For the longest time", "Never", "Only at night"], "Amber warns that red is next."],
        ["Non-blocking timing", "To switch from green to amber after 5 s with millis(), you check…", ["if millis() − lastChange ≥ 5000", "if analogRead(A0) > 5", "if delay(5000) returned", "if the LED is hot"], "Compare elapsed time with the duration."],
        ["Digital outputs", "How many digital outputs does this light need (red, green, two RGB channels)?", ["4", "1", "2", "13"], "One pin per LED or channel."],
      ],
    ],
  },
  {
    id: "traffic-button",
    difficulty: ["memme", "eemhm"],
    extra: [
      ["Digital inputs", "Which function reads the button state?", ["digitalRead(2)", "analogWrite(2)", "pulseIn(2)", "tone(2)"], "digitalRead returns HIGH or LOW.", "easy"],
      ["INPUT_PULLUP", "With INPUT_PULLUP, where is the button wired?", ["Between the pin and GND", "Between the pin and 5V", "Across the LED", "To A0 only"], "The internal pull-up holds HIGH; the button pulls it to GND.", "medium"],
      ["Debouncing", "One press counts as three. The fix is to…", ["ignore changes for about 20–50 ms after the first one", "use a bigger LED", "remove the resistor", "press harder"], "Debouncing filters out contact bounce.", "medium"],
      ["Floating inputs", "An input reads HIGH when you touch the wire, without pressing. Most likely…", ["the pin is floating; add a pull-down or use INPUT_PULLUP", "the button is broken", "the LED is reversed", "it's normal"], "A floating pin picks up noise from your hand.", "hard"],
    ],
    title: { en: "Pedestrian button", ar: "زر المشاة" },
    goal: "Read a push button reliably and use it to change the light sequence.",
    explanation:
      "A push button connects its two sides only while pressed. Wired between 5V and an input pin with nothing else, the pin 'floats' when the button is released and reads random values. A 10 kΩ pull-down resistor from the pin to GND holds it LOW until the button pulls it HIGH. (Alternatively, use INPUT_PULLUP and wire the button to GND; then pressed reads LOW.) Contacts bounce for a few milliseconds, so ignore changes shorter than about 20–50 ms (debouncing). When the button is pressed, the state machine finishes the current timing safely, goes through amber to red for cars, then lets pedestrians cross.",
    parts: ["push_button", "resistor_10k"],
    mentor: {
      alternative:
        "A floating pin is like a weather vane in the wind: it points anywhere. The pull-down resistor is a gentle spring that holds it at 'no' until the button firmly pushes it to 'yes'.",
      practiceTask:
        "In the 3D Lab, wire the button between 5V and D2, add the 10 kΩ resistor from D2 to GND, and run Validate Wiring.",
    },
    quizzes: [
      [
        ["Floating inputs", "Without a pull-down or pull-up, a released button's input pin…", ["reads random values (it floats)", "reads exactly 0", "reads 1023", "turns off the board"], "An unconnected input picks up noise."],
        ["Pull-down resistors", "Where does the 10 kΩ pull-down resistor go?", ["From the input pin to GND", "From 5V to VIN", "In series with the LED", "Across the relay"], "It gently holds the pin at 0 V."],
        ["INPUT_PULLUP", "With INPUT_PULLUP and the button wired to GND, a pressed button reads…", ["LOW", "HIGH", "1023", "random values"], "The internal pull-up holds HIGH; pressing connects to GND."],
        ["Debouncing", "Why debounce the button?", ["Contacts bounce, so one press can look like several", "To make it louder", "To save power", "Buttons need 12 V"], "Ignore very short changes."],
        ["Digital inputs", "How do you set the button pin in setup() when using an external pull-down?", ["pinMode(2, INPUT)", "pinMode(2, OUTPUT)", "analogWrite(2, 255)", "Serial.begin(2)"], "The resistor is external, so a plain INPUT is enough."],
      ],
      [
        ["Pull-down resistors", "With an external pull-down, a pressed button (wired to 5V) reads…", ["HIGH", "LOW", "floating", "negative"], "Pressing connects the pin to 5 V."],
        ["Floating inputs", "A 'floating' input is one that…", ["isn't connected to a defined voltage", "is under water", "is very fast", "has a resistor"], "Pull resistors give it a defined level."],
        ["Debouncing", "A typical debounce time is about…", ["20–50 ms", "5 seconds", "1 minute", "1 μs"], "Long enough to skip the bounce, short enough to feel instant."],
        ["Pull-down resistors", "Why 10 kΩ rather than 10 Ω for the pull-down?", ["A large value holds the pin LOW while letting very little current flow when pressed", "10 Ω is brighter", "10 kΩ is a capacitor", "It doesn't matter"], "10 Ω would waste current when the button is pressed."],
        ["State machines", "The button is pressed while the light is green. The light should…", ["finish safely through amber to red, then let pedestrians cross", "jump instantly to red", "turn everything off", "ignore it forever"], "Skipping amber would surprise drivers."],
      ],
    ],
  },
];

export const parkingStages: RawStage[] = [
  {
    id: "parking-distance",
    difficulty: ["eemmh", "emeeh"],
    extra: [
      ["Triggering", "Which HC-SR04 pin receives the start pulse?", ["TRIG", "ECHO", "GND", "VCC"], "TRIG starts the measurement; ECHO reports the time.", "easy"],
      ["Distance formula", "An object is 50 cm away. The echo lasts about…", ["2900 μs", "50 μs", "290 μs", "29000 μs"], "50 × 58 = 2900 μs.", "hard"],
      ["Echo timing", "ECHO stays HIGH longer when the object is…", ["farther away", "closer", "the same distance", "smaller"], "More distance means a longer round trip.", "easy"],
      ["Logic levels", "Why is it fine to connect the HC-SR04 directly to an Uno?", ["The Uno's pins work at 5 V, the same as ECHO", "The Uno ignores voltage", "ECHO is only 1 V", "It isn't fine at all"], "A 5 V board accepts the 5 V ECHO signal.", "medium"],
    ],
    title: { en: "Measuring distance with the HC-SR04", ar: "قياس المسافة بحساس HC-SR04" },
    goal: "Trigger the ultrasonic sensor, time the echo and convert it to centimetres.",
    explanation:
      "The HC-SR04 sends a burst of ultrasound and listens for the echo. Your code sends a HIGH pulse of at least 10 μs on TRIG; the module then holds ECHO HIGH for as long as the sound took to travel there and back. pulseIn(echoPin, HIGH) measures that time in microseconds. Sound travels about 0.034 cm per μs and makes a round trip, so distance (cm) ≈ duration × 0.034 ÷ 2, or roughly duration ÷ 58. Power it from 5V and GND; ECHO outputs 5 V, so a 3.3 V-only board needs level shifting. The cited module variant measures about 2–400 cm.",
    parts: ["hc_sr04", "arduino_uno"],
    mentor: {
      alternative:
        "It's like shouting in a canyon and timing the echo: the longer you wait, the farther the wall. Divide by two because the sound goes there and back.",
      practiceTask:
        "In the 3D Lab, connect HC-SR04 VCC → 5V, GND → GND, TRIG → D9 and ECHO → D10, then run Validate Wiring.",
    },
    quizzes: [
      [
        ["Triggering", "How do you start a measurement?", ["Send a HIGH pulse of at least 10 μs on TRIG", "Read A0", "Connect ECHO to GND", "Turn on the buzzer"], "The trigger pulse starts one measurement."],
        ["Echo timing", "What does the length of the ECHO pulse represent?", ["The sound's round-trip travel time", "The battery level", "The temperature", "The LED brightness"], "Longer echo = farther object."],
        ["Distance formula", "The echo lasts 580 μs. The distance is about…", ["10 cm", "5 cm", "58 cm", "580 cm"], "580 ÷ 58 ≈ 10 cm."],
        ["Distance formula", "Why divide by 2 in the distance formula?", ["The sound travels to the object and back", "The sensor has two 'eyes'", "To convert to inches", "Because of the buzzer"], "Only half the trip is the distance."],
        ["Logic levels", "Connecting ECHO directly to a 3.3 V-only board…", ["risks damage; use level shifting", "is always fine", "makes it more accurate", "requires 12 V"], "ECHO outputs 5 V."],
      ],
      [
        ["Echo timing", "Which Arduino function measures the ECHO pulse length?", ["pulseIn(echoPin, HIGH)", "analogRead(echoPin)", "tone(echoPin)", "delay(echoPin)"], "pulseIn returns the pulse length in microseconds."],
        ["Distance formula", "The echo lasts 1160 μs. The distance is about…", ["20 cm", "10 cm", "116 cm", "2 cm"], "1160 ÷ 58 = 20 cm."],
        ["Sensor range", "The cited HC-SR04 variant measures roughly…", ["2–400 cm", "0–1 cm", "10–100 m", "any distance"], "Check the datasheet range for your module."],
        ["Powering sensors", "The HC-SR04 is powered from…", ["5V and GND", "A0", "the buzzer", "TRIG"], "VCC to 5V, GND to GND."],
        ["Distance formula", "About how far does sound travel per microsecond?", ["0.034 cm", "34 cm", "3.4 m", "340 km"], "About 340 m/s, which is 0.034 cm/μs."],
      ],
    ],
  },
  {
    id: "parking-buzzer",
    difficulty: ["ememm", "meeme"],
    extra: [
      ["Polarity", "On the catalog's active buzzer, which terminal goes to the signal pin?", ["PLUS", "MINUS", "GND", "VCC"], "PLUS to the pin, MINUS to GND.", "easy"],
      ["Warning design", "Beeping faster as the car gets closer works because…", ["the beep rate carries the distance information", "faster beeps use less power", "slow beeps aren't allowed", "the buzzer needs it"], "The beep rate maps to urgency.", "medium"],
      ["Active vs passive", "You need different tones for different warnings. Which buzzer suits that?", ["A passive buzzer driven with tone()", "An active buzzer with HIGH/LOW", "No buzzer", "An LED"], "A passive buzzer plays the frequency you send it.", "hard"],
      ["Current limits", "Why might a loud buzzer need a transistor?", ["Its current can exceed what a pin can safely supply", "Transistors make sound", "For I²C", "To read the sensor"], "The transistor switches the larger current.", "hard"],
    ],
    title: { en: "Beeping with an active buzzer", ar: "التنبيه بالجرس" },
    goal: "Drive the active buzzer from a digital pin and make clear warning beeps.",
    explanation:
      "An active buzzer has its own oscillator: give it power and it beeps at a fixed tone, so digitalWrite(pin, HIGH) is enough. (A passive buzzer needs a changing signal, for example from tone().) It has polarity: PLUS to the signal pin, MINUS to GND. Check its current rating; if it needs more current than a pin can supply, drive it through a transistor. Short on/off beeps are easier to notice than a constant tone and can show how urgent a warning is.",
    parts: ["buzzer_active"],
    mentor: {
      alternative:
        "An active buzzer is like a doorbell with the ring built in: you just press the button (HIGH) and it rings. A passive buzzer is a small speaker — you have to play the note yourself.",
      practiceTask:
        "In the 3D Lab, connect the buzzer's PLUS to D8 and MINUS to GND, then run Validate Wiring.",
    },
    quizzes: [
      [
        ["Active buzzers", "How do you make an active buzzer beep?", ["Set its pin HIGH", "Send it an analog reading", "Connect it only to GND", "Send it I²C data"], "Its built-in oscillator makes the tone."],
        ["Active vs passive", "A passive buzzer needs…", ["a changing signal, such as from tone()", "no signal at all", "a relay", "an I²C address"], "A passive buzzer is a simple speaker."],
        ["Polarity", "Which buzzer lead goes to GND?", ["MINUS (−)", "PLUS (+)", "Either", "Neither"], "PLUS goes to the signal pin."],
        ["Current limits", "If a buzzer needs more current than a pin can supply, you should…", ["drive it through a transistor", "connect it to A0", "remove GND", "use a longer wire"], "A transistor switches the larger current."],
        ["Warning design", "Why use short beeps rather than a constant tone?", ["Changing beeps are easier to notice and can show urgency", "They use more pins", "Constant tones are impossible", "Buzzers can't stay on"], "The beep rate can carry information."],
      ],
      [
        ["Active buzzers", "An active buzzer contains…", ["its own oscillator, so plain on/off power makes it beep", "a speaker that needs tone()", "a microcontroller", "a distance sensor"], "That's what 'active' means."],
        ["Polarity", "The buzzer's PLUS lead connects to…", ["the signal pin, e.g. D8", "GND", "nothing", "ECHO"], "MINUS goes to GND."],
        ["Active buzzers", "digitalWrite(8, LOW) on the buzzer pin…", ["stops the beep", "beeps louder", "changes the tone", "resets the board"], "LOW removes its power."],
        ["Active vs passive", "Using tone() with an active buzzer…", ["isn't needed; HIGH and LOW are enough", "is required", "breaks the Uno", "adds Wi-Fi"], "tone() is for passive buzzers."],
        ["Current limits", "Where do you find how much current the buzzer needs?", ["In its datasheet or module rating", "From the LED colour", "On the breadboard", "On the USB cable"], "Always check the rating for your exact part."],
      ],
    ],
  },
  {
    id: "parking-warning",
    difficulty: ["eemhm", "emmme"],
    extra: [
      ["Edge cases", "Which reading should NOT trigger the red 'too close' warning?", ["0 from a timeout with no echo", "5 cm", "8 cm", "9 cm"], "0 means no echo, so treat it as far.", "hard"],
      ["Mapping values", "With pause = distance × 10 ms, which distance beeps fastest?", ["10 cm", "30 cm", "50 cm", "100 cm"], "A smaller distance gives a shorter pause.", "medium"],
      ["Thresholds", "How many warning zones does this design use?", ["Three: clear, beeping and very close", "One", "Ten", "None"], "Green, beeping, then red with a continuous tone.", "easy"],
      ["Noisy readings", "The average of the last three readings, 40, 41 and 39 cm, is…", ["40 cm", "120 cm", "13 cm", "39 cm"], "(40 + 41 + 39) ÷ 3 = 40.", "medium"],
    ],
    title: { en: "From distance to warning", ar: "من المسافة إلى التحذير" },
    goal: "Turn distance readings into LED and beep warnings that respond smoothly.",
    explanation:
      "Map the distance to a warning: the green LED when the path is clear (e.g. over 50 cm), beeps that get faster as the object gets closer (e.g. pause = distance × 10 ms), and the red LED plus a continuous tone under 10 cm. Use millis() so measuring and beeping don't block each other. Readings jump around, so average a few measurements or ignore single outliers. When nothing reflects the sound, pulseIn can return 0 or time out; treat that as 'far', not 'touching'. Each indicator LED needs its own 220 Ω resistor.",
    parts: ["led_green", "led_red", "resistor_220", "buzzer_active"],
    mentor: {
      alternative:
        "Think of the game 'hot and cold': the closer you get, the faster the 'hotter!' calls. Your code turns centimetres into a beep speed, with green for 'cold' and red for 'burning hot'.",
      practiceTask:
        "In the 3D Lab, add the green LED on D11 and the red LED on D12, each through a 220 Ω resistor, keep the buzzer on D8, and validate the whole circuit.",
    },
    quizzes: [
      [
        ["Mapping values", "As the object gets closer, the beeps should…", ["get faster", "get slower", "stop", "change colour"], "Shorter pauses signal greater urgency."],
        ["Thresholds", "Under 10 cm, this design shows…", ["the red LED and a continuous tone", "the green LED only", "nothing", "a slower beep"], "The closest zone gets the strongest warning."],
        ["Noisy readings", "How do you handle jumpy distance readings?", ["Average a few readings or ignore single outliers", "Use a longer USB cable", "Turn off the buzzer", "Use analogRead"], "Filtering steadies the warning."],
        ["Edge cases", "pulseIn returns 0 because nothing reflected the sound. Treat it as…", ["far / out of range", "touching", "10 cm", "an error that stops the program"], "0 means 'no echo', not 'zero distance'."],
        ["Non-blocking timing", "Why use millis() for the beep timing?", ["So the sensor keeps measuring between beeps", "millis() makes beeps louder", "delay() isn't allowed", "It saves a resistor"], "Blocking delays make warnings lag."],
      ],
      [
        ["Mapping values", "With pause = distance × 10 ms, an object at 30 cm gives a pause of…", ["300 ms", "30 ms", "3 s", "3 ms"], "30 × 10 = 300 ms."],
        ["Thresholds", "In this design, the green LED means…", ["the path is clear / far enough", "stop now", "the battery is low", "the sensor failed"], "Green is the safe zone."],
        ["Non-blocking timing", "If you use delay() for the beeps, what goes wrong?", ["The sensor isn't read during the delay, so warnings lag", "The LEDs get brighter", "Nothing", "The buzzer breaks"], "The program can't measure while it waits."],
        ["Noisy readings", "One reading says 3 cm between readings of 40 cm. Most likely it's…", ["an outlier to ignore", "a real wall", "the LED", "the speed of sound changing"], "A single jump is usually noise."],
        ["Current limiting", "Each indicator LED needs…", ["its own 220 Ω resistor", "no resistor", "the buzzer in series", "a relay"], "Every LED needs current limiting."],
      ],
    ],
  },
];

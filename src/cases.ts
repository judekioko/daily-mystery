export type EvidenceType = "message" | "log" | "receipt" | "statement" | "photo" | "note" | "document";

export interface Evidence {
  type: EvidenceType;
  title: string;
  time?: string;
  body: string;
}

export interface Question {
  q: string;
  options: string[];
  answer: number; // index into options; never sent to the client
}

export interface Case {
  title: string;
  brief: string;
  evidence: Evidence[];
  questions: Question[];
  explanation: string;
}

export const cases: Case[] = [
  {
    title: "The Alibi",
    brief:
      "At 21:14, Anna messaged her partner Mark: she was home, cooking. At 21:18 her phone joined Wi-Fi 8 km away. At 21:23 her card was used. Three people say they saw her. Something doesn't add up.",
    evidence: [
      { type: "message", title: "Anna → Mark", time: "21:14", body: "Home, cooking. Come by whenever, no rush!  (Delivery details: Scheduled message, created 20:41)" },
      { type: "log", title: "Phone Wi-Fi log", time: "21:18", body: "Connected: Harbour_Cafe_Guest. Distance from Anna's home: 8 km." },
      { type: "receipt", title: "Lakeview Pharmacy & Gifts", time: "21:23", body: "Birthday candles x2, gift wrap, card. Paid: Anna's debit card, contactless." },
      { type: "log", title: "Doorbell camera, Anna's home", time: "20:38 – 21:30", body: "20:38 Anna leaves carrying a tote bag. 21:02 Ben (Anna's brother) enters using spare key. No other entries." },
      { type: "statement", title: "Lila (neighbour)", time: "21:10", body: "I saw Anna through her kitchen window, moving around in her red coat. Lights were on. Definitely her." },
      { type: "statement", title: "Tom (café barista)", time: "21:20", body: "Anna picked up a boxed cake at the counter. She was in a hurry. Red coat, I remember it." },
      { type: "note", title: "Anna's phone notes", time: "Yesterday", body: "Sat = Mark's 30th. Cake pick-up Harbour Café 8:30?? Candles, wrap. Ask Ben to keep lights on + wear my coat lol" },
      { type: "message", title: "Mark → Anna", time: "21:15", body: "Can't wait. Leaving the office at 22:00, see you then." },
    ],
    questions: [
      {
        q: "Where was Anna at 21:14?",
        options: ["At home, cooking", "Near Harbour Café, 8 km away", "Inside Lakeview Pharmacy", "Impossible to determine"],
        answer: 1,
      },
      {
        q: "Who did Lila actually see in the kitchen window at 21:10?",
        options: ["Anna", "Mark", "Ben, wearing Anna's coat", "A stranger who broke in"],
        answer: 2,
      },
      {
        q: "Why did Anna fake being home?",
        options: ["She was having an affair", "She was planning a surprise for Mark", "She was shoplifting", "She was avoiding the police"],
        answer: 1,
      },
    ],
    explanation:
      "The 21:14 message was scheduled at 20:41, so it proves nothing about her location. Doorbell footage shows Anna left at 20:38 and never returned, and an 8 km trip can't be made in 4 minutes. Ben entered at 21:02 and, per her notes, wore her coat and kept the lights on, which is what Lila saw. The cake, candles and wrap point to a surprise for Mark's 30th.",
  },
  {
    title: "Cold Storage",
    brief:
      "A restaurant lost $9,000 of seafood overnight when the walk-in fridge warmed to 11°C. Everyone has a theory. Find the trigger, the real cause, and the red herring.",
    evidence: [
      { type: "log", title: "Fridge temperature", time: "01:30 – 03:00", body: "01:30 2°C. 02:00 2°C. 02:10 7°C. 02:30 11°C. Alarm muted since 22:15 (manual override)." },
      { type: "log", title: "Door sensor", time: "01:55", body: "Walk-in door opened for 40 seconds, then closed." },
      { type: "log", title: "Breaker panel", time: "02:05", body: "Circuit B tripped (overload). Circuit B feeds: walk-in compressor + back-kitchen sockets." },
      { type: "log", title: "Cleaning contractor", time: "01:50 – 02:20", body: "Badge in 01:50, out 02:20. Equipment sheet: industrial floor polisher used in back kitchen 02:00 – 02:20." },
      { type: "document", title: "Electrician's invoice", time: "22:00", body: "New compressor installed by Dan K. Note: 'Dedicated circuit recommended for compressor. Customer declined (extra cost). Signed: Chef Amara.'" },
      { type: "message", title: "Chef Amara → Dan", time: "23:30", body: "Thanks for tonight. Compressor sounds great. Don't worry about the dedicated line, we'll revisit next quarter." },
    ],
    questions: [
      {
        q: "What triggered the temperature rise?",
        options: ["The walk-in door being opened", "The floor polisher overloading circuit B", "A faulty new compressor", "A power cut in the area"],
        answer: 1,
      },
      {
        q: "What is the root cause of the loss?",
        options: ["The cleaner's behaviour", "Dan's installation was faulty", "The dedicated circuit was declined to save cost", "The alarm was set too low"],
        answer: 2,
      },
      {
        q: "Which evidence is a red herring?",
        options: ["The 40-second door opening", "The breaker trip at 02:05", "The invoice note", "The cleaner's equipment sheet"],
        answer: 0,
      },
    ],
    explanation:
      "The compressor and back-kitchen sockets share circuit B. The polisher ran from 02:00 and tripped the breaker at 02:05, so the compressor lost power. Forty seconds of door-opening at 01:55 changed nothing: the temperature was still 2°C at 02:00. The root cause was the decision to skip the dedicated circuit that the electrician recommended and the chef declined.",
  },
  {
    title: "The Perfect Flat",
    brief:
      "A 3-bedroom flat in a prime area for $600 a month. The 'owner' is abroad on a mission and needs a deposit today. Before anyone wires money, investigate.",
    evidence: [
      { type: "document", title: "The listing", time: "Posted today", body: "3BR, balcony, gym, security. $600/month. Owner: Dr. Peter Lang, 'serving overseas'. Deposit required to 'hold the keys, which are with my lawyer'." },
      { type: "message", title: "Owner → You", time: "Today", body: "Another family arrives tomorrow. Send $600 deposit by gift-card code or wire to secure it. I trust you." },
      { type: "log", title: "Domain lookup", time: "Today", body: "lakeview-rentals.com registered 6 days ago, privacy-protected registrant, hosted abroad." },
      { type: "photo", title: "Reverse image search", time: "Today", body: "Listing photos match a boutique-hotel gallery published in 2019, in another country." },
      { type: "document", title: "Land registry search", time: "Today", body: "Registered owner of this address: Hannah Obuya. No record of 'Peter Lang'. Property is currently occupied by a tenant." },
      { type: "note", title: "Area price check", time: "Today", body: "Comparable 3BRs in this area rent for $1,400 – $1,800/month." },
    ],
    questions: [
      {
        q: "Is this listing legitimate?",
        options: ["Yes, just underpriced", "No, it's a rental scam", "Probably, once the deposit clears", "Impossible to tell"],
        answer: 1,
      },
      {
        q: "Which single piece of evidence is the hardest proof?",
        options: ["The price is half the market rate", "The owner is pushing urgency", "The registry shows a different owner", "The domain is new"],
        answer: 2,
      },
      {
        q: "What should you do next?",
        options: ["Pay half the deposit as a test", "Ask for a video call, then pay", "Don't pay; report the listing and tell the registered owner", "Pay by wire, which is safer than gift cards"],
        answer: 2,
      },
    ],
    explanation:
      "Low price, urgency and a new domain are warning signs, but the registry is proof: the person who 'owns' the flat does not appear in the records, and the real owner has a tenant living there. Stolen hotel photos and a gift-card payment request seal it. Never pay; report the listing and alert the real owner.",
  },
];

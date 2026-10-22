/**
 * SAATHI Real-Time Comprehensive Emergency Keyword Engine & Highlighter
 * Supports all 34 Emergency Categories (English, Romanised Hindi, Hinglish, Devanagari & ASR Variants)
 * Accurately tags and highlights distress tokens in real-time as user speaks or types.
 */

import React from 'react';

export interface HighlightedSegment {
  text: string;
  isKeyword: boolean;
  category?: string;
  label?: string;
  badgeColor?: string;
}

export interface KeywordDefinition {
  category: string;
  label: string;
  color: string;
  words: string[];
}

export const EMERGENCY_KEYWORDS: KeywordDefinition[] = [
  // 1. DIRECT DISTRESS AND REQUESTS FOR HELP
  {
    category: 'distress',
    label: 'DISTRESS · HELP REQUEST',
    color: '#dc2626',
    words: [
      // English
      'help me', 'please help', 'somebody help', 'send help', 'i need help', 'emergency',
      'urgent', 'please hurry', 'save me', 'rescue me', 'get me out', 'i am in danger',
      "i'm scared", "i'm afraid", "i'm trapped", "i can't escape", "i can't get out",
      "i'm not safe", "please don't leave me", 'please stay on the line', 'i need police',
      'call an ambulance', 'send someone', 'come quickly', 'he is here', 'she is here',
      'they found me', "i can't talk", "i can't explain", "i don't have much time",
      'please listen', 'please believe me',
      // Hindi / Romanised Hindi
      'bachao', 'mujhe bachao', 'madad karo', 'meri madad karo', 'koi bachao', 'koi hai',
      'please bachao', 'jaldi aao', 'jaldi bhejo', 'mujhe help chahiye', 'mujhe madad chahiye',
      'emergency hai', 'bahut zaroori hai', 'meri jaan khatre mein hai', 'main khatre mein hoon',
      'mujhe darr lag raha hai', 'main safe nahi hoon', 'main phas gayi hoon', 'main phas gaya hoon',
      'main nikal nahi paa rahi', 'main bahar nahi nikal paa raha', 'mujhe yahan se nikalo',
      'police bhejo', 'ambulance bhejo', 'kisi ko bhejo', 'please phone mat kaatna',
      'meri baat suno', 'meri baat samjho', 'mere paas time nahi hai', 'woh yahin hai',
      'woh aa gaya hai', 'woh mujhe dhoondh raha hai',
      // Hinglish & Devanagari
      'please help karo', 'mujhe rescue karo', 'i am not safe', 'koi police ko bulao',
      'jaldi se kisi ko bhejo', "i can't speak", 'main freely baat nahi kar sakti',
      'please line pe raho', 'kuch gadbad ho gayi hai', 'situation bahut serious hai',
      'mujhe abhi help chahiye', 'मदद', 'बचाओ', 'हेल्प', 'खतरा', 'इमरजेंसी'
    ]
  },

  // 2. DOMESTIC VIOLENCE AND INTIMATE-PARTNER ABUSE
  {
    category: 'domestic_violence',
    label: 'DOMESTIC VIOLENCE · IPV',
    color: '#e11d48',
    words: [
      // Physical violence
      'he hit me', 'she hit me', 'he slapped me', 'he punched me', 'he kicked me',
      'he pushed me', 'he dragged me', 'he beat me', 'he choked me', 'he strangled me',
      'he grabbed my neck', 'he pulled my hair', 'he threw me', 'he burned me',
      'he stabbed me', 'he attacked me', 'he hurt me', 'he is hitting me', 'he is beating the children',
      // Hindi / Romanised Hindi
      'usne mujhe maara', 'mujhe thappad maara', 'usne punch maara', 'laat maari', 'dhakka diya',
      'baal kheenche', 'ghaseeta', 'gala dabaya', 'gala pakda', 'mera gala daba raha hai',
      'mujhe jalaya', 'chot pahunchayi', 'peeta hai', 'roz maarta hai', 'abhi maar raha hai',
      'bachchon ko bhi maarta hai', 'mujhe deewar pe maara', 'mujhe zameen pe gira diya',
      'mujhe pakad ke rakha hai', 'maar raha hai', 'mar raha hai', 'maarra hai', 'maar rha hai',
      // Threats and coercive control
      'my husband is threatening me', 'my wife is threatening me', 'my partner is violent',
      'my ex is outside', "he won't let me leave", "she won't let me leave", 'he locked me inside',
      'he took my keys', 'he took my phone', 'he controls my money', 'he checks my phone',
      'he tracks me', 'he threatened to kill me', "he said he'll kill the children",
      'he threatened my family', "he won't let me call anyone", 'he forces me to stay',
      "i'm afraid to go home", 'pati maarte hain', 'pati dhamki deta hai', 'biwi dhamki de rahi hai',
      'ghar pe maarpeet ho rahi hai', 'ghar mein violence ho raha hai', 'mujhe ghar se nikalne nahi deta',
      'mujhe band kar diya', 'darwaza lock kar diya', 'phone chheen liya', 'paise nahi deta',
      'har waqt nazar rakhta hai', 'meri location track karta hai', 'jaan se maarne ki dhamki',
      'bachchon ko maarne ki dhamki', 'ghar jaane se darr lagta hai', 'woh mujhe chhodta nahi',
      'mujhe kisi se baat nahi karne deta', 'meri marzi nahi chalti',
      // Relationship & household context
      'boyfriend ghar aa gaya', 'ex ghar ke bahar', 'sasural wale maarte hain', 'family violence',
      'dowry', 'dahej', 'dowry demand', 'dahej ke liye maarte hain', 'forced marriage', 'zabardasti shaadi'
    ]
  },

  // 3. WEAPONS AND THREATS INVOLVING OBJECTS
  {
    category: 'weapon',
    label: 'WEAPON · ARMED THREAT',
    color: '#b91c1c',
    words: [
      // Weapons & objects
      'gun', 'pistol', 'revolver', 'rifle', 'firearm', 'knife', 'chaku', 'chaaku', 'chakku',
      'blade', 'razor', 'sword', 'talwar', 'dagger', 'machete', 'axe', 'kulhadi', 'rod',
      'iron rod', 'danda', 'stick', 'bat', 'baseball bat', 'hammer', 'hathoda', 'screwdriver',
      'scissors', 'broken glass', 'bottle', 'stone', 'brick', 'acid', 'petrol', 'kerosene',
      'lighter', 'explosive', 'bomb', 'country-made pistol', 'katta', 'katta hai', 'katta nikala',
      'weapon', 'sharp object', 'चाकू', 'बंदूक', 'हथियार',
      // Threatening actions
      'he has a gun', 'she has a knife', 'he pulled a knife', 'he is holding a weapon',
      'he pointed a gun at me', 'he threatened me with a knife', 'he is coming with a weapon',
      'he is carrying a pistol', 'he loaded the gun', 'he said he would stab me',
      'he is trying to break in with a rod', 'he threw acid', 'he has petrol',
      'he is threatening to burn the house', 'he is waving a knife', 'he is outside with a weapon',
      'uske paas bandook hai', 'usne chaku nikaala', 'woh chaku leke aaya hai', 'katta dikha raha hai',
      'bandook taan di', 'pistol dikha raha hai', 'hathiyar lekar khada hai', 'lohe ki rod se maara',
      'danda lekar peeche pada hai', 'kaatne ki dhamki de raha hai', 'goli maarne ki dhamki',
      'chaku maarne ki dhamki', 'acid phenka', 'petrol daal raha hai', 'ghar jalane ki dhamki'
    ]
  },

  // 4. STALKING, HARASSMENT AND UNWANTED PURSUIT
  {
    category: 'stalking',
    label: 'STALKING · HARASSMENT',
    color: '#9333ea',
    words: [
      'stalking', 'stalker', 'following me', 'following me home', 'waiting outside',
      'keeps following me', "won't leave me alone", 'watching my house', 'watching me',
      'lurking outside', 'following my route', 'tracking my location', 'tracking my phone',
      'gps tracker', 'hidden tracker', 'keeps calling', 'repeated calls', 'unwanted calls',
      'abusive messages', 'threatening texts', 'blackmail', 'extortion', 'doxxing',
      'threatening to leak photos', 'sharing private pictures', 'revenge porn',
      'unwanted touching', 'eve-teasing', 'sexual harassment', 'workplace harassment',
      'online harassment', 'cyberstalking', 'impersonation', 'fake account', 'threatening emails',
      'mera peecha kar raha hai', 'mera roz peecha karta hai', 'ghar tak peeche aata hai',
      'bahar khada rehta hai', 'mera wait karta hai', 'mujhe ghoorta hai', 'meri location nikaal li',
      'phone track kar raha hai', 'baar baar call karta hai', 'mana karne ke baad bhi call karta hai',
      'gande messages bhejta hai', 'dhamki bhare messages', 'photo viral karne ki dhamki',
      'photo leak karega', 'blackmail kar raha hai', 'peecha nahi chhodta', 'office ke bahar khada hai',
      'college tak follow karta hai', 'fake id bana di', 'meri identity use kar raha hai'
    ]
  },

  // 5. SEXUAL VIOLENCE AND REPRODUCTIVE COERCION
  {
    category: 'sexual_violence',
    label: 'SEXUAL VIOLENCE · COERCION',
    color: '#c026d3',
    words: [
      'rape', 'sexual assault', 'sexual abuse', 'forced sex', 'non-consensual sex',
      'sexual coercion', 'unwanted sexual touching', 'groping', 'molestation', 'attempted rape',
      'sexually assaulted', 'forced me', 'i said no', "i didn't consent", "he wouldn't stop",
      'i was unconscious', 'i was drugged', 'someone touched me', 'he forced himself on me',
      'he is forcing me', 'he threatened me into sex', 'reproductive coercion', 'forced pregnancy',
      'forced abortion', 'contraception sabotage', 'forced sterilisation', 'forced to marry',
      'child sexual abuse', 'inappropriate touching', 'sexual exploitation',
      'balatkar', 'rape kiya', 'zabardasti ki', 'zabardasti physical relation',
      'meri marzi ke bina', 'maine mana kiya tha', 'phir bhi nahi ruka', 'mere saath galat kaam kiya',
      'mujhe galat tareeke se chhua', 'chhed-chhad', 'badtameezi ki', 'mere saath zabardasti hui',
      'mujhe behosh kar diya', 'nasha de diya', 'zabardasti pregnancy', 'zabardasti abortion',
      'pregnancy terminate karne ka pressure', 'protection use nahi karne diya', 'meri consent nahi thi'
    ]
  },

  // 6. PREGNANCY, LABOUR AND CHILDBIRTH EMERGENCIES
  {
    category: 'pregnancy',
    label: 'PREGNANCY · OBSTETRIC EMERGENCY',
    color: '#f59e0b',
    words: [
      'pregnant', 'pregnancy', 'expecting a baby', 'due date', 'due today', 'overdue',
      'full term', 'weeks pregnant', 'months pregnant', 'high-risk pregnancy', 'twins',
      'triplets', 'prenatal', 'antenatal', 'maternity', 'labour', 'labor', 'contractions',
      'water broke', 'waters breaking', 'mucus plug', 'delivery', 'childbirth', 'birth',
      'baby coming', 'baby is coming now',
      'pregnant hoon', 'pregnant hu', 'pregnancy hai', 'pet mein bachcha hai', 'bachcha hone wala hai',
      'delivery ka time aa gaya', 'meri due date aaj hai', 'due date nikal gayi', 'nau mahine ho gaye',
      'nauva mahina chal raha hai', 'dard shuru ho gaya', 'labour pain ho raha hai',
      'contraction aa rahe hain', 'paani toot gaya', 'paani nikal raha hai',
      'bachcha abhi hone wala hai', 'delivery ho rahi hai', 'hospital pahunchna hai',
      // Warning signs
      'heavy bleeding', 'bleeding during pregnancy', 'severe abdominal pain', 'severe headache',
      'reduced fetal movement', 'baby not moving', 'waters broke early', 'premature labour',
      'cord visible', 'baby crowning', 'pushing urge', 'severe pain during labour',
      'birth happening now', 'retained placenta', 'excessive bleeding after delivery',
      'postpartum bleeding', 'pregnancy injury', 'fall during pregnancy', 'hit in the stomach',
      'bahut bleeding ho rahi hai', 'pregnancy mein khoon aa raha hai', 'pet mein bahut tez dard',
      'bachcha hil nahi raha', 'bachche ki movement kam ho gayi', 'baby move nahi kar raha',
      'movement nahi hai', 'paani jaldi toot gaya', 'time se pehle delivery', 'bachcha neeche aa raha hai',
      'bachcha nikal raha hai', 'zor lag raha hai', 'delivery abhi ho rahi hai',
      'delivery ke baad khoon band nahi ho raha', 'pet par chot lagi', 'pregnancy mein gir gayi',
      // Coercion in pregnancy
      'husband hit me while pregnant', 'partner threatened me while pregnant',
      "won't let me go to hospital", "won't let me take medicine", 'pregnancy hidden',
      'no access to doctor', 'pregnancy due to assault', 'afraid to tell family',
      'ghar wale hospital nahi jaane dete', 'pati hospital nahi le ja raha',
      'zabardasti abortion karwa rahe hain'
    ]
  },

  // 7. MEDICAL EMERGENCIES AND ACUTE SYMPTOMS
  {
    category: 'medical',
    label: 'MEDICAL EMERGENCY · INJURY',
    color: '#ea580c',
    words: [
      // Breathing & consciousness
      "can't breathe", 'difficulty breathing', 'shortness of breath', 'choking', 'gasping',
      'stopped breathing', 'not breathing', 'unconscious', 'passed out', 'fainted',
      'unresponsive', 'not waking up', 'seizure', 'convulsions', 'fit', 'daura', 'behosh',
      'saans nahi aa rahi', 'saans ruk rahi hai', 'hosh nahi hai', 'hosh nahi aa raha',
      'gir kar behosh ho gaya',
      // Heart & neurological
      'chest pain', 'pressure in chest', 'severe headache', 'sudden weakness', 'face drooping',
      "can't move one side", 'sudden confusion', 'trouble speaking', 'stroke symptoms',
      'severe allergic reaction', 'swelling of throat', 'severe bleeding', 'coughing blood',
      'vomiting blood', 'sudden collapse', 'heart attack', 'suspected stroke',
      'seene mein dard', 'seene mein dabav', 'saans lene mein dikkat', 'saans phool rahi hai',
      'achanak kamzori', 'ek taraf haath nahi chal raha', 'bol nahi paa raha', 'chehra tedha ho gaya',
      'pet mein asahniya dard', 'khoon ki ulti', 'bahut khoon beh raha hai', 'achanak gir gaya',
      'dil ka daura lag raha hai', 'allergy se gala sooj gaya',
      // Injuries & trauma
      'accident', 'road accident', 'hit by car', 'hit by bike', 'fell from height', 'fall',
      'head injury', 'head hit', 'bleeding', 'deep cut', 'fracture', 'broken bone', 'burn',
      'scald', 'electric shock', 'electrocution', 'animal attack', 'dog bite', 'snake bite',
      'poisoning', 'swallowed chemicals', 'choking on food', 'drowning', 'near drowning',
      'stab wound', 'gunshot wound', 'strangulation injury', 'severe pain', 'multiple injuries',
      'accident ho gaya', 'gaadi ne takkar maari', 'bike se gir gaya', 'unchai se gir gaya',
      'sar phat gaya', 'sar pe chot lagi', 'khoon beh raha hai', 'gehra ghaav', 'haddi toot gayi',
      'jal gaya', 'current lag gaya', 'kutte ne kaata', 'saanp ne kaata', 'zehar kha liya',
      'galti se dawa zyada le li', 'kuch zehreela kha liya', 'paani mein doob gaya',
      'chaku laga', 'goli lagi', 'gala dabaya gaya', 'khun aa raha hai', 'khoon nikal raha hai'
    ]
  },

  // 8. CHILDREN AND DEPENDENT PEOPLE AT RISK
  {
    category: 'child_risk',
    label: 'CHILD / DEPENDENT AT RISK',
    color: '#f97316',
    words: [
      'child', 'baby', 'infant', 'toddler', 'minor', 'schoolchild', 'newborn', 'my child',
      'my baby', 'children are inside', 'child is missing', 'missing child', 'child alone',
      'child locked inside', 'child abandoned', 'child being hit', 'child being threatened',
      'child witnessed violence', 'child cannot escape', 'child is injured', 'baby is not breathing',
      'child is choking', 'child swallowed something', 'child is being abused',
      'child is being exploited', 'child is being forced to work', 'child marriage',
      'forced marriage of minor', 'child trafficking', 'neglect', 'unsafe caregiver',
      'he is in the next room', 'the baby is with me', 'my child saw everything',
      'mera bachcha', 'mera baby', 'bachcha ghar mein hai', 'bachche andar band hain',
      'bachcha akela hai', 'bachcha kho gaya', 'bachcha mil nahi raha', 'bachche ko maar raha hai',
      'bachche ko dhamki de raha hai', 'bachcha chotil hai', 'bachche ko saans nahi aa rahi',
      'bachcha behosh hai', 'bachcha kuch zehreela kha gaya', 'bachche ke saath abuse ho raha hai',
      'bachche ko zabardasti kaam karwate hain', 'nabalig ki shaadi', 'bachchi ko bechne ki baat',
      'bachche ko le gaya', 'bachcha bhaag nahi sakta'
    ]
  },

  // 9. KIDNAPPING, CONFINEMENT AND TRAFFICKING
  {
    category: 'trafficking',
    label: 'KIDNAPPING · TRAFFICKING',
    color: '#be123c',
    words: [
      'kidnapped', 'abducted', 'taken against my will', 'forced into a car',
      'forced me into a vehicle', 'locked in a room', 'locked in a house', 'locked in a basement',
      'tied up', 'restrained', 'handcuffed', 'held captive', "won't let me leave",
      'not allowed to leave', 'trapped', 'locked door', 'barred exit', 'took my passport',
      'took my id', 'confiscated my phone', 'forced labour', 'human trafficking',
      'sex trafficking', 'forced prostitution', 'being sold', 'debt bondage', 'forced to work',
      'trafficked across border', 'smuggled', 'recruiter took me', 'kept under guard',
      'being transported against my will', 'kidnap kar liya', 'agwa kar liya',
      'zabardasti gaadi mein bithaya', 'zabardasti le ja rahe hain', 'kamre mein band kar diya',
      'ghar mein lock kar diya', 'baandh ke rakha hai', 'haath pair baandh diye',
      'jaane nahi de rahe', 'bahar nahi nikalne dete', 'passport rakh liya',
      'zabardasti kaam karwa rahe hain', 'mujhe bechne ki baat kar rahe hain',
      'mere upar nazar rakhi ja rahi hai', 'guard laga rakha hai', 'meri marzi ke bina le ja rahe hain'
    ]
  },

  // 10. SELF-HARM AND SUICIDE-RELATED DISTRESS
  {
    category: 'self_harm',
    label: 'SELF-HARM · SUICIDE RISK',
    color: '#9f1239',
    words: [
      'i want to die', "i don't want to live", 'i want to end my life', "i'm going to kill myself",
      'i might hurt myself', 'i want to disappear forever', "i can't go on", "there's no point living",
      'everyone would be better without me', 'goodbye forever', 'this is my last call',
      'i took pills to hurt myself', 'i have hurt myself', 'i am bleeding after hurting myself',
      'i tried to end my life', "i don't feel safe with myself", 'i might do something to myself',
      'mujhe mar jaana hai', 'jeene ka mann nahi hai', 'main jeena nahi chahta',
      'main jeena nahi chahti', 'apni jaan le lunga', 'apni jaan le lungi',
      'main khud ko maar dunga', 'main khud ko maar dungi', 'sab khatam karna hai',
      'ab aur nahi hota', 'jeene ka koi matlab nahi', 'mere bina sab theek rahenge',
      'yeh meri aakhri call hai', 'maine goliyan kha li', 'maine khud ko chot pahunchayi',
      'main apne aap se safe nahi hoon', 'main kuch kar baithunga', 'main kuch kar baithungi'
    ]
  },

  // 11. THREATS TO KILL OR SERIOUSLY INJURE SOMEONE
  {
    category: 'threat_to_life',
    label: 'THREAT TO LIFE',
    color: '#b91c1c',
    words: [
      "i'll kill you", "i'm going to kill her", 'i will kill him', "i'll shoot you",
      "i'll stab you", "i'll burn this house", "you won't survive", 'i will finish you',
      "i'm coming for you", 'i know where you live', 'your children will pay',
      "i'll kill the whole family", "i'll make you disappear", "i'm going to attack them",
      "i'm waiting outside", "i have a weapon and i'm coming",
      'jaan se maar dunga', 'jaan se maar dungi', 'goli maar dunga', 'chaku maar dunga',
      'zinda nahi chhodunga', 'tujhe khatam kar dunga', 'sabko maar dunga', 'ghar jala dunga',
      'bachchon ko nahi chhodunga', 'poore parivaar ko maar dunga', 'tere ghar aa raha hoon',
      'tujhe dhoondh lunga', 'tujhe utha lunga', 'dekh lunga tujhe', 'aaj tujhe nahi chhodunga',
      'tere peeche aa raha hoon', 'jaan se mar', 'jaan se maarne'
    ]
  },

  // 12. SEXUAL EXPLOITATION, BLACKMAIL AND DIGITAL ABUSE
  {
    category: 'digital_abuse',
    label: 'SEXUAL EXPLOITATION · CYBER ABUSE',
    color: '#a21caf',
    words: [
      'intimate photos', 'private pictures', 'nude photos', 'private video', 'leaked video',
      'intimate image abuse', 'image-based abuse', 'sextortion', 'sexual blackmail',
      'blackmail me', "pay me or i'll leak it", 'share your pictures', 'leaked my photos',
      'morphed photos', 'deepfake', 'ai-generated nude', 'fake nude', 'hacked account',
      'account takeover', 'password stolen', 'tracking app', 'spyware', 'hidden camera',
      'camera in bathroom', 'hidden cctv', 'secretly recorded', 'recording without consent',
      'webcam recording', 'threatening to expose me', 'threatening to send pictures to family',
      'threatening to send pictures to employer', 'photo viral kar dunga', 'video leak kar dunga',
      'private photo bhej', 'nude photo', 'photo morphed kar di', 'fake video bana di',
      'ai se fake photo banayi', 'bina permission video banaya', 'chupke recording ki',
      'bathroom mein camera', 'account hack kar liya', 'password chura liya',
      'whatsapp hack ho gaya', 'photo se blackmail kar raha hai',
      'paise maang raha hai warna video leak karega', 'family ko bhejne ki dhamki',
      'office mein bhejne ki dhamki'
    ]
  },

  // 13. ROBBERY, BURGLARY, HOME INVASION AND PROPERTY THREATS
  {
    category: 'robbery',
    label: 'ROBBERY · BREAK-IN · INTRUDER',
    color: '#ea580c',
    words: [
      'robbery', 'armed robbery', 'mugging', 'snatching', 'chain snatching', 'phone snatching',
      'bag snatching', 'theft in progress', 'burglary', 'break-in', 'breaking the door',
      'trying to enter', 'forced entry', 'intruder', 'stranger inside the house',
      'someone broke in', 'trespassing', 'house invasion', 'attempted robbery', 'carjacking',
      'vehicle theft', 'vehicle blocking exit', 'vandalism', 'arson', 'setting fire',
      'threatening to burn property', 'petrol bomb', 'suspicious forced entry',
      'loot liya', 'lootne ki koshish', 'chori ho rahi hai', 'ghar mein chor ghus gaya',
      'darwaza tod raha hai', 'zabardasti andar aa raha hai', 'ghar mein ghus aaya',
      'anjaan aadmi ghar mein hai', 'chain chheen li', 'phone chheen liya', 'bag chheen liya',
      'gaadi chheen li', 'raasta rok diya', 'ghar jalane aaya hai', 'aag lagane ki dhamki',
      'dukaan mein loot', 'hathiyar ke saath loot'
    ]
  },

  // 14. FIRE, SMOKE, GAS LEAKS AND ENVIRONMENTAL HAZARDS
  {
    category: 'fire',
    label: 'FIRE · GAS LEAK · HAZARD',
    color: '#ef4444',
    words: [
      'fire', 'flames', 'smoke', 'building on fire', 'house on fire', 'kitchen fire',
      'trapped in fire', 'smoke inhalation', 'gas leak', 'lpg leak', 'cylinder leaking',
      'smell of gas', 'gas cylinder explosion', 'electrical fire', 'short circuit',
      'electric sparks', 'live wire', 'chemical spill', 'toxic fumes', 'carbon monoxide alarm',
      'building collapse', 'wall collapsing', 'landslide', 'flood', 'drowning risk',
      'earthquake', 'trapped under rubble', 'stampede', 'crowd crush', 'bridge collapse',
      'train accident', 'industrial accident', 'aag lag gayi', 'ghar mein aag lag gayi',
      'dhuaan bhar gaya', 'smoke se saans nahi aa rahi', 'gas leak ho rahi hai',
      'cylinder se gas nikal rahi hai', 'gas ki smell aa rahi hai', 'cylinder phat gaya',
      'short circuit ho gaya', 'taar mein current hai', 'chemical gir gaya', 'deewar gir rahi hai',
      'imaarat gir gayi', 'malbe ke neeche dab gaya', 'baadh aa gayi', 'paani mein phas gaye',
      'bhukamp aa gaya', 'bheed mein dab rahe hain'
    ]
  },

  // 15. SUBSTANCE POISONING, OVERDOSE AND INTOXICATION
  {
    category: 'poisoning',
    label: 'POISONING · OVERDOSE',
    color: '#c2410c',
    words: [
      'overdose', 'too many pills', 'took too much medicine', 'sleeping pills',
      'unknown tablets', 'poison', 'swallowed poison', 'pesticide', 'cleaning chemical',
      'acid ingestion', 'alcohol poisoning', 'drug overdose', 'unconscious after drinking',
      'suspected poisoning', 'drink was spiked', 'someone drugged me', 'drink tasted strange',
      'injection without consent', 'forced to take drugs', 'accidental ingestion',
      'child swallowed tablets', 'chemical burns', 'severe vomiting after ingestion',
      'zyada goliyan kha li', 'galti se zyada dawa le li', 'sleeping pills kha li',
      'zehar kha liya', 'zehreeli cheez pee li', 'pesticide pee liya', 'acid pee liya',
      'drink mein kuch mila diya', 'drink ke baad hosh nahi raha', 'zabardasti nasha diya',
      'bachche ne goliyan kha li', 'dawa khane ke baad behosh ho gaya', 'kuch galat kha liya'
    ]
  },

  // 16. LABOUR EXPLOITATION, WORKPLACE ABUSE AND FORCED WORK
  {
    category: 'labour_exploitation',
    label: 'LABOUR EXPLOITATION · ABUSE',
    color: '#b45309',
    words: [
      'forced labour', 'bonded labour', 'unpaid wages', 'wages withheld',
      'employer threatened me', 'supervisor assaulted me', 'locked in factory',
      'locked in workplace', 'passport confiscated', 'identity documents withheld',
      'forced overtime', 'forced to work without food', 'unsafe working conditions',
      'threatened with deportation', 'workplace assault', 'workplace sexual harassment',
      "employer won't let me leave", 'domestic worker abuse', 'migrant worker exploitation',
      'child labour', 'forced begging', 'withheld salary', 'recruitment fraud',
      'threatened by contractor', 'zabardasti kaam karwa rahe hain', 'mazdoori nahi di',
      'salary rok li', 'malik dhamki deta hai', 'supervisor ne maara', 'factory mein band kar diya',
      'kaam ki jagah se nikalne nahi dete', 'khaana nahi dete', 'ghar mein kaam karne wali ko maarta hai',
      'thekedaar dhamki de raha hai', 'naukri ka jhaansa diya', 'paise dene ke naam par phasa liya'
    ]
  },

  // 17. MISSING PERSONS AND PEOPLE UNABLE TO RETURN SAFELY
  {
    category: 'missing_person',
    label: 'MISSING PERSON',
    color: '#0891b2',
    words: [
      'missing person', 'missing child', "can't find my child", 'last seen',
      "hasn't returned home", 'disappeared', 'lost contact', 'phone switched off',
      'missing elderly person', 'dementia', 'wandered away', 'lost in unfamiliar area',
      'separated from family', 'separated from child', "can't get home", 'stranded',
      'no transport', 'locked out', 'nowhere to go', 'afraid to return home',
      'being forced to return', 'person not answering', 'suspected abduction',
      'last known location', 'vulnerable missing person', 'bachcha kho gaya',
      'bachcha mil nahi raha', 'ghar nahi lauta', 'pata nahi kahan hai', 'phone band aa raha hai',
      'ghar se gayab hai', 'buzurg kho gaye', 'raasta bhatak gaya', 'parivaar se bichhad gaya',
      'bachche se bichhad gayi', 'ghar nahi ja sakta', 'raste mein phas gaya', 'raat ko kahan jaun',
      'mujhe wapas ghar bhejne par majboor kar rahe hain'
    ]
  },

  // 18. DISABILITY, ELDERLY PEOPLE AND DEPENDENT-CARE EMERGENCIES
  {
    category: 'dependent_care',
    label: 'DEPENDENT · ACCESSIBILITY NEED',
    color: '#0d9488',
    words: [
      'elderly person alone', 'dependent adult', 'wheelchair user trapped', 'person unable to walk',
      'person unable to hear', 'non-speaking caller', 'communication disability',
      'caregiver missing', 'caregiver abusive', 'caregiver abandoned me', 'medication withheld',
      'denied food', 'denied water', 'mobility assistance needed', 'oxygen supply stopped',
      'ventilator alarm', 'medical equipment failure', 'cannot reach the door',
      "can't transfer to wheelchair", 'bedridden person trapped', 'person needs sign-language support',
      'elderly person being hit', 'dementia-related confusion', 'buzurg akela hai',
      'chal nahi sakta', 'wheelchair mein phas gaya', 'sun nahi sakta', 'bol nahi sakta',
      'caretaker chhod ke chala gaya', 'dawa nahi dete', 'paani nahi dete', 'oxygen band ho gayi',
      'machine kaam nahi kar rahi', 'bistar se uth nahi sakta', 'darwaze tak nahi ja sakta',
      'buzurg ko maarta hai', 'patient ko akela chhod diya'
    ]
  },

  // 19. UNSAFE TRANSPORT, ROAD INCIDENTS AND PUBLIC-SPACE EMERGENCIES
  {
    category: 'transport_safety',
    label: 'TRANSPORT · PUBLIC SAFETY',
    color: '#d97706',
    words: [
      "driver won't stop", 'driver changed route', 'driver locked the doors',
      'being followed in a taxi', 'cab driver threatening me', 'rideshare safety issue',
      'bus harassment', 'train harassment', 'someone touching me on the bus',
      'someone following me at the station', 'unsafe driver', 'driver appears intoxicated',
      'road rage', 'hit and run', 'pedestrian struck', 'vehicle rollover', 'trapped in vehicle',
      'vehicle submerged', 'road blocked by attackers', 'crowd threatening me', 'public assault',
      'suspicious person following me', 'being surrounded', 'driver gaadi nahi rok raha',
      'galat raaste par le ja raha hai', 'gaadi ke darwaze lock kar diye', 'cab wala dhamki de raha hai',
      'taxi mein unsafe feel ho raha hai', 'bus mein chhed raha hai', 'station par peecha kar raha hai',
      'gaadi se takkar maar di', 'gaadi ke andar phas gaya', 'logon ne gher liya',
      'bheed maarne aa rahi hai', 'nikalne ka raasta band hai'
    ]
  },

  // 20. PANIC, ACUTE DISTRESS AND COMMUNICATION DIFFICULTY
  {
    category: 'acute_distress',
    label: 'ACUTE DISTRESS · PANIC',
    color: '#8b5cf6',
    words: [
      'panic attack', 'hyperventilating', 'shaking', 'trembling', "can't think clearly",
      'voice shaking', 'crying uncontrollably', 'frozen with fear', 'feeling unsafe',
      'confused', 'disoriented', "can't remember location", "can't answer",
      'afraid someone will hear me', 'whispering', 'trying not to make noise',
      'person is listening', 'someone is next to me', 'i have to hang up', "can't talk now",
      "i'll call later", "i can't say it out loud", 'panic ho raha hai', 'saans tez chal rahi hai',
      'haath kaanp rahe hain', 'main bol nahi paa rahi', 'rona band nahi ho raha',
      'dimag kaam nahi kar raha', 'mujhe location yaad nahi', 'main jawab nahi de sakti',
      'koi sun lega', 'woh paas mein hai', 'main dheere bol rahi hoon', 'phone kaatna padega',
      'abhi baat nahi kar sakti', 'baad mein call karungi', 'main bol nahi sakti par sun sakti hoon'
    ]
  },

  // 21. LOCATION, ESCAPE, AND ACCESS TO HELP
  {
    category: 'location_escape',
    label: 'LOCATION · TRAPPED',
    color: '#059669',
    words: [
      "i'm at home", "i'm outside", "i'm in the car", "i'm in the bathroom", "i'm in the bedroom",
      "i'm on the roof", "i'm in a basement", "i'm at the station", "i'm near the temple",
      "i'm at a bus stop", "i'm in a moving vehicle", "i'm in a hotel", "i'm at work",
      "i'm at school", "i'm near a hospital", "i'm in an unfamiliar place", "i don't know where i am",
      "i don't know the address", 'the location is wrong',
      'locked inside', 'door is locked', 'exit blocked', "can't open the door", 'window blocked',
      'trapped in a room', 'stuck in an elevator', 'trapped in a vehicle', 'surrounded',
      "can't get past him", 'he is blocking the door', 'she is blocking the exit', "can't leave safely",
      'keys taken', 'phone taken', 'my phone battery is dying', 'no signal', 'network is gone',
      'call is dropping', "i can't call back", 'main ghar par hoon', 'main bahar hoon',
      'main gaadi mein hoon', 'main bathroom mein hoon', 'main chhat par hoon', 'main basement mein hoon',
      'main station par hoon', 'mandir ke paas hoon', 'bus stop par hoon', 'gaadi chal rahi hai',
      'mujhe address nahi pata', 'mujhe location nahi pata', 'main raasta bhatak gayi',
      'location galat hai', 'yahan ka naam nahi pata', 'andar band hoon', 'darwaza lock hai',
      'raasta band hai', 'darwaza nahi khul raha', 'kamre mein phas gayi', 'lift mein phas gaya',
      'gaadi mein phas gayi', 'chaaron taraf se gher liya', 'darwaze par khada hai',
      'nikalne nahi de raha', 'chaabi le li', 'phone le liya', 'battery khatam ho rahi hai',
      'signal nahi aa raha', 'call cut ho rahi hai', 'wapas call mat karna'
    ]
  },

  // 22. SAFE COMMUNICATION, CODE WORDS AND INDIRECT DISCLOSURES
  {
    category: 'covert_duress',
    label: 'COVERT DURESS · CODE WORD',
    color: '#7c3aed',
    words: [
      'can you order a pizza', 'pizza order', 'i need the usual help', 'can you stay on the line',
      "please don't call me back", "text me, don't call", 'can you send someone',
      "i can't talk right now", 'everything is fine', "i'll explain when i'm alone",
      'i need to go somewhere safe', 'can you tell my sister', 'please ask me yes or no questions',
      "i can't say it directly", "don't mention this to him", "please don't leave a voicemail",
      'use the other number', 'i need a quiet place', "don't tell my family",
      'please wait until i message you', 'can you pretend this is a wrong number',
      'pizza order karna hai', 'bas usual wali help chahiye', 'line par raho',
      'wapas call mat karna', 'call nahi message karna', 'sab theek hai',
      'akele mein bataungi', 'mujhe safe jagah jaana hai', 'meri behen ko bata dena',
      'sirf haan ya na mein puchho', 'seedha nahi bol sakti', 'uske saamne mat bolna',
      'voicemail mat chhodna', 'doosre number par message karna', 'ghar walon ko mat batana'
    ]
  },

  // 23. DENIAL, CORRECTION, MINIMISATION AND CONFLICTING STATEMENTS
  {
    category: 'denial_correction',
    label: 'DENIAL · CORRECTION CUE',
    color: '#64748b',
    words: [
      'nothing happened', 'no injury', 'no weapon', 'no threat', 'nobody touched me',
      "i'm not hurt", 'i am safe', "i'm fine", "he didn't hit me", "she didn't threaten me",
      "i don't want police", "i don't need an ambulance", 'kuch nahi hua', 'chot nahi lagi',
      'hathiyar nahi hai', 'dhamki nahi di', 'usne nahi maara', 'kisi ne nahi chhua',
      'main theek hoon', 'main safe hoon', 'police nahi chahiye', 'ambulance nahi chahiye',
      'mujhe kuch nahi hua', 'actually', 'i need to correct that', 'i was mistaken',
      'i said the wrong address', "that's not what i meant", 'it happened earlier',
      'it is happening now', 'he left', 'he came back', "i'm not sure", 'i heard something',
      "i couldn't see clearly", "i couldn't understand", 'i may have said it wrong',
      'ek correction hai', 'maine galat bataya', 'address galat tha', 'mera matlab woh nahi tha',
      'pehle hua tha', 'woh chala gaya', 'woh wapas aa gaya', 'mujhe nahi pata',
      'pakka nahi hai', 'awaaz aayi thi', 'saaf nahi dikha', 'samajh nahi aaya', 'maine galat bol diya'
    ]
  },

  // 24. TIME, ESCALATION AND RECURRENCE
  {
    category: 'temporal',
    label: 'TEMPORAL · ESCALATION',
    color: '#eab308',
    words: [
      'right now', 'right away', 'immediately', 'just now', 'a few minutes ago',
      'earlier today', 'yesterday', 'last night', 'every day', 'every night',
      'for weeks', 'for months', 'for the second time', 'this keeps happening',
      "it's getting worse", 'he came back', 'she came back', 'he is outside again',
      'the threats are escalating', 'he has done this before', 'the last time',
      'the first time', 'it started today', 'it has been going on for years',
      'isi waqt', 'abhi abhi', 'kuch minute pehle', 'aaj subah', 'kal raat',
      'kai hafton se', 'kai mahino se', 'phir se', 'dobara', 'baar baar',
      'yeh hamesha hota hai', 'ab aur badh gaya hai', 'woh phir aa gaya',
      'aaj dobara hua', 'pehle bhi kiya hai', 'pehli baar', 'bahut saalon se', 'abhi shuru hua hai'
    ]
  },

  // 25. PEOPLE, RELATIONSHIPS AND POTENTIAL PERPETRATORS
  {
    category: 'relationship',
    label: 'PERPETRATOR · RELATIONSHIP',
    color: '#0284c7',
    words: [
      'ex-husband', 'ex-wife', 'in-laws', 'mother-in-law', 'father-in-law', 'landlord',
      'tenant', 'neighbour', 'coworker', 'caregiver', 'security guard', 'police officer',
      'shauhar', 'sasural', 'sasur', 'saas', 'devar', 'nanad', 'padosi', 'kirayedar',
      'anjaan aadmi'
    ]
  },

  // 26. FIREARMS, EXPLOSIONS AND MASS-CASUALTY THREATS
  {
    category: 'mass_casualty',
    label: 'FIREARMS · MASS CASUALTY',
    color: '#991b1b',
    words: [
      'shooting', 'gunfire', 'shots fired', 'gunshots', 'firing', 'active shooter',
      'bomb threat', 'bomb found', 'explosive device', 'suspicious package', 'blast',
      'explosion', 'grenade', 'detonator', 'ammunition', 'bullets', 'rounds fired',
      'multiple people injured', 'multiple casualties', 'crowd under attack', 'people running',
      'people screaming', 'panic in a crowd', 'building under attack', 'armed group',
      'terrorist attack', 'hostage situation', 'people held hostage', 'goliyan chal rahi hain',
      'firing ho rahi hai', 'goli ki awaaz aayi', 'bandook se fire kiya', 'bomb ki dhamki',
      'bomb mila hai', 'dhamaka ho gaya', 'grenade mila', 'bahut log ghaayal hain',
      'kai logon ko goli lagi', 'bheed par hamla', 'log bhaag rahe hain', 'log cheekh rahe hain',
      'imaarat par hamla', 'hathiyarband log aaye hain', 'logon ko bandhak bana liya'
    ]
  },

  // 27. ANIMAL ATTACKS AND OTHER IMMEDIATE PHYSICAL HAZARDS
  {
    category: 'physical_hazard',
    label: 'ANIMAL ATTACK · HAZARD',
    color: '#c2410c',
    words: [
      'dog attacking', 'pack of dogs', 'animal bite', 'snake in the house', 'snake bite',
      'rabid animal', 'wild animal attack', 'aggressive bull', 'animal trapped with child',
      'bee swarm', 'swept away', 'trapped in water', 'electric wire down', 'exposed live wire',
      'unstable structure', 'falling debris', 'elevator trapped', 'machinery entrapment',
      'severe weather exposure', 'heatstroke', 'hypothermia', 'kutta hamla kar raha hai',
      'kutte kaat rahe hain', 'saanp ghar mein hai', 'saanp ne kaata', 'jaanwar ne hamla kiya',
      'bachcha jaanwar ke saath phas gaya', 'paani mein beh gaya', 'paani mein doob raha hai',
      'current wala taar gira hai', 'deewar girne wali hai', 'machine mein haath phas gaya',
      'bahut garmi se behosh ho gaya', 'thand se haalat kharab hai'
    ]
  },

  // 28. ACCESS TO MEDICAL CARE, MEDICATION AND URGENT ASSISTANCE
  {
    category: 'care_access',
    label: 'CARE ACCESS BARRIER',
    color: '#0284c7',
    words: [
      'need a doctor', "can't reach hospital", 'hospital is too far', 'no transport',
      'cannot afford treatment', 'medication unavailable', 'medicine stopped',
      'insulin unavailable', 'oxygen running out', 'dialysis missed', 'medicine reaction',
      'medical equipment stopped', 'no one to help', 'cannot access healthcare',
      'refused treatment', 'denied medical care', 'need urgent surgery',
      'child needs urgent treatment', 'doctor chahiye', 'hospital nahi pahunch paa rahe',
      'hospital bahut door hai', 'gaadi nahi hai', 'ilaaj ke paise nahi hain', 'dawa nahi mil rahi',
      'dawa band kar di', 'insulin khatam ho gayi', 'oxygen khatam ho rahi hai',
      'machine band ho gayi', 'kisi ne ilaaj nahi karwaya', 'medical help chahiye',
      'bachche ko turant doctor chahiye'
    ]
  },

  // 29. REQUESTS FOR POLICE, AMBULANCE, SHELTER, LEGAL AID OR A SAFE PLACE
  {
    category: 'agency',
    label: 'AGENCY · SHELTER REQUEST',
    color: '#2563eb',
    words: [
      'need police', 'send police', 'call emergency services', 'need ambulance', 'need a hospital',
      'need a safe house', 'need a shelter', 'somewhere safe to stay', 'need a place for my children',
      'need legal aid', 'need a lawyer', 'need a protection order', 'need counselling',
      'need a social worker', 'need child protection', 'need someone to accompany me',
      'need transport to safety', 'need help leaving my partner', 'need help reporting abuse',
      'need a female operator', 'need an interpreter', 'police chahiye', 'police bhejo',
      'emergency services ko call karo', 'ambulance chahiye', 'hospital le chalo',
      'safe house chahiye', 'shelter chahiye', 'rehne ke liye safe jagah chahiye',
      'bachchon ke saath rehne ki jagah chahiye', 'kanooni madad chahiye', 'lawyer chahiye',
      'counselling chahiye', 'social worker chahiye', 'bachchon ki protection chahiye',
      'mere saath koi chale', 'safe jagah tak le chalo', 'partner ko chhodne mein help chahiye',
      'complaint karni hai', 'female operator chahiye', 'translator chahiye',
      'police', 'pcr', '112', 'thana', 'policewala', 'police station', '108', '181', 'mahila helpline'
    ]
  },

  // 30. COMMUNICATION AND NETWORK FAILURE
  {
    category: 'connection_failure',
    label: 'CONNECTION · NETWORK FAILURE',
    color: '#64748b',
    words: [
      'call dropped', 'call disconnected', 'connection lost', 'network unavailable',
      'no signal', 'poor signal', 'battery low', 'phone dying', 'cannot call back',
      'call failed', 'audio cut out', 'voice breaking', "can't hear you", "you can't hear me",
      'microphone stopped', 'phone taken away', 'someone ended the call', 'forced to hang up',
      'call ended unexpectedly', 'call cut ho gayi', 'connection toot gaya', 'network nahi hai',
      'signal nahi hai', 'no network', 'battery low hai', 'phone band hone wala hai',
      'wapas call nahi kar sakti', 'call nahi lag rahi', 'awaaz cut ho rahi hai',
      'aapki awaaz nahi aa rahi', 'meri awaaz nahi ja rahi', 'mic kaam nahi kar raha',
      'usne phone kaat diya', 'zabardasti phone rakhwa diya'
    ]
  },

  // 31. ALCOHOL-RELATED AGGRESSION AND IMPAIRED SAFETY
  {
    category: 'impaired_aggression',
    label: 'SUBSTANCE / ALCOHOL AGGRESSION',
    color: '#ea580c',
    words: [
      'drunk and violent', 'intoxicated and threatening', 'high and aggressive',
      'under the influence', 'driving drunk', 'threatening while drunk', 'smashed things',
      'broke furniture', 'became violent after drinking', 'threatening family',
      'unable to stand', 'suspected drink spiking', 'sharab peekar maar raha hai',
      'nashe mein dhamki de raha hai', 'nashe mein gaadi chala raha hai',
      'peene ke baad violent ho gaya', 'samaan tod diya', 'ghar mein tod-phod kar raha hai',
      'nashe mein behosh ho gaya'
    ]
  },

  // 32. FINANCIAL COERCION AND THREATS INVOLVING MONEY
  {
    category: 'financial_abuse',
    label: 'FINANCIAL COERCION · EXTORTION',
    color: '#b45309',
    words: [
      'forced to transfer money', 'forced to give pin', 'bank account controlled',
      'money withheld', 'salary taken away', 'threatened over debt', 'extortion',
      'loan threats', 'blackmail for money', 'forced signature', 'forged signature',
      'took my atm card', 'took my bank documents', 'financial control', 'forced to take a loan',
      'threatened over dowry', 'demanding money to release someone', 'zabardasti paise le liye',
      'pin batane ko majboor kiya', 'bank account control karta hai', 'salary chheen leta hai',
      'karz ke naam par dhamki', 'paise ke liye blackmail', 'atm card le liya',
      'bank ke kagaz le liye', 'zabardasti loan karwaya', 'dahej ke paise maang rahe hain',
      'kisi ko chhodne ke liye paise maang rahe hain'
    ]
  },

  // 33. EMERGENCY RESPONSE AND OPERATOR ACTION TERMS
  {
    category: 'response_tracking',
    label: 'RESPONSE · ACTION TRACKING',
    color: '#475569',
    words: [
      'police requested', 'ambulance requested', 'dispatch requested', 'dispatch acknowledged',
      'unit assigned', 'unit en route', 'responder arrived', 'responder on scene',
      'service confirmed', 'service not confirmed', 'callback attempted', 'callback failed',
      'sms sent', 'message delivered', 'message failed', 'shelter contacted', 'bed held',
      'referral accepted', 'referral declined', 'handoff completed', 'incident reopened',
      'incident unresolved', 'safety unconfirmed', 'police bulayi', 'ambulance maangi',
      'dispatch request bheji', 'request acknowledge hui', 'unit assign hui',
      'team raste mein hai', 'responder pahunch gaya', 'service confirm hui',
      'service confirm nahi hui', 'callback kiya', 'callback nahi laga', 'message deliver hua',
      'message nahi gaya', 'shelter se baat hui', 'referral accept hua', 'case dobara khola',
      'incident abhi unresolved hai', 'safety confirm nahi hui'
    ]
  },

  // 34. COMMON HINDI SPEECH VARIATIONS AND ASR ERROR RECOVERY
  {
    category: 'asr_variants',
    label: 'DISTRESS VARIANT · ASR',
    color: '#dc2626',
    words: [
      'banduk', 'bandook', 'madad kro', 'help krdo', 'gala dabaaya', 'strangled me',
      'phone chin liya', 'mobile le liya', 'bachaao', 'bachaoo'
    ]
  }
];

interface FlatPattern {
  word: string;
  category: string;
  label: string;
  color: string;
}

// Pre-index patterns sorted by length descending to prioritize longer phrases
let CACHED_PATTERNS: FlatPattern[] | null = null;

function getCachedPatterns(): FlatPattern[] {
  if (CACHED_PATTERNS) return CACHED_PATTERNS;

  const list: FlatPattern[] = [];
  const seen = new Set<string>();

  for (const def of EMERGENCY_KEYWORDS) {
    for (const raw of def.words) {
      const w = raw.trim().toLowerCase();
      if (!w || seen.has(w)) continue;
      seen.add(w);
      list.push({
        word: w,
        category: def.category,
        label: def.label,
        color: def.color
      });
    }
  }

  // Sort descending by length so longer phrases match first
  list.sort((a, b) => b.word.length - a.word.length);
  CACHED_PATTERNS = list;
  return CACHED_PATTERNS;
}

function isAlphaNum(ch: string): boolean {
  if (!ch) return false;
  // Match Latin characters, numbers, and Devanagari range
  return /[a-zA-Z0-9\u0900-\u097F]/.test(ch);
}

interface MatchInterval {
  start: number;
  end: number;
  pattern: FlatPattern;
}

/**
 * Tokenizes text and produces an array of segments with matched emergency badges.
 * Uses greedy non-overlapping interval selection with word-boundary awareness.
 */
export function parseEmergencyKeywords(text: string): {
  segments: HighlightedSegment[];
  detectedKeywords: Array<{ label: string; category: string; color: string; word: string }>;
} {
  if (!text || text.trim().length === 0) {
    return { segments: [], detectedKeywords: [] };
  }

  const patterns = getCachedPatterns();
  const lowerText = text.toLowerCase();
  const intervals: MatchInterval[] = [];

  for (const p of patterns) {
    const pLen = p.word.length;
    let fromIdx = 0;

    while (fromIdx <= lowerText.length - pLen) {
      const idx = lowerText.indexOf(p.word, fromIdx);
      if (idx === -1) break;

      const endIdx = idx + pLen;

      // Check word boundaries: character before and after must not be alphanumeric
      const charBefore = idx > 0 ? text[idx - 1] : '';
      const charAfter = endIdx < text.length ? text[endIdx] : '';

      const leftOk = !isAlphaNum(charBefore);
      const rightOk = !isAlphaNum(charAfter);

      if (leftOk && rightOk) {
        // Check overlap with already accepted longer intervals
        const overlaps = intervals.some(
          (inv) => Math.max(idx, inv.start) < Math.min(endIdx, inv.end)
        );

        if (!overlaps) {
          intervals.push({ start: idx, end: endIdx, pattern: p });
        }
      }

      fromIdx = idx + 1;
    }
  }

  // Sort intervals by start position ascending
  intervals.sort((a, b) => a.start - b.start);

  const segments: HighlightedSegment[] = [];
  const detectedKeywordsMap = new Map<string, { label: string; category: string; color: string; word: string }>();
  let currentPos = 0;

  for (const inv of intervals) {
    if (inv.start > currentPos) {
      segments.push({
        text: text.slice(currentPos, inv.start),
        isKeyword: false
      });
    }

    const matchedText = text.slice(inv.start, inv.end);
    segments.push({
      text: matchedText,
      isKeyword: true,
      category: inv.pattern.category,
      label: inv.pattern.label,
      badgeColor: inv.pattern.color
    });

    detectedKeywordsMap.set(inv.pattern.label + ':' + matchedText.toLowerCase(), {
      label: inv.pattern.label,
      category: inv.pattern.category,
      color: inv.pattern.color,
      word: matchedText
    });

    currentPos = inv.end;
  }

  if (currentPos < text.length) {
    segments.push({
      text: text.slice(currentPos),
      isKeyword: false
    });
  }

  return {
    segments,
    detectedKeywords: Array.from(detectedKeywordsMap.values())
  };
}

/**
 * Reusable React Component for displaying text with highlighted emergency keywords
 */
export const HighlightedEmergencyText: React.FC<{
  text: string;
  markStyle?: React.CSSProperties;
  fallbackStyle?: React.CSSProperties;
}> = ({ text, markStyle, fallbackStyle }) => {
  if (!text) return null;

  const parsed = parseEmergencyKeywords(text);
  if (!parsed.segments.length) {
    return <span style={fallbackStyle}>{text}</span>;
  }

  return (
    <span style={fallbackStyle}>
      {parsed.segments.map((seg, i) =>
        seg.isKeyword ? (
          <mark
            key={i}
            style={{
              background: seg.badgeColor || '#dc2626',
              color: '#ffffff',
              padding: '1px 5px',
              borderRadius: '4px',
              fontWeight: 700,
              fontSize: 'inherit',
              margin: '0 2px',
              display: 'inline-block',
              lineHeight: 1.25,
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              ...markStyle
            }}
            title={seg.label}
          >
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </span>
  );
};

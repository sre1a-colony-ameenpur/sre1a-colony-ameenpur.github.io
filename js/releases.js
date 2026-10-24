// "What's new" entries, newest first. Member-facing wording: say what a member can now do, not how it works.
// Add an entry here for each release; `date` is the day it went live (YYYY-MM-DD) and `time` (HH:MM, India time) is optional: shown with the date when set.
export const RELEASES = [
  { date: '2026-10-25', time: '04:00',
    title: { en: 'Easier Money, Members, Gallery and Reports screens', te: 'సులభమైన డబ్బు, సభ్యులు, గ్యాలరీ, నివేదికల స్క్రీన్‌లు' },
    items: [
      { en: 'Money: All payments and Monthly accounts are icons beside the title; Add expense and Raise fee request are a + button at the bottom right; the year\'s approved expenses are now in Monthly accounts, between this month and all time.', te: 'డబ్బు: అన్ని చెల్లింపులు, నెలవారీ లెక్కలు శీర్షిక పక్కన గుర్తులుగా ఉన్నాయి; ఖర్చు జోడించు, రుసుము అభ్యర్థన కింద కుడివైపు + బటన్‌గా ఉన్నాయి; ఈ సంవత్సరం ఆమోదించిన ఖర్చులు ఇప్పుడు నెలవారీ లెక్కలలో, ఈ నెల మరియు మొత్తం మధ్య ఉన్నాయి.' },
      { en: 'Members: Load from sheet and Add member are icons beside the title, and members show their picture in the list and when you edit them.', te: 'సభ్యులు: షీట్ నుండి లోడ్ చేయి, సభ్యుడిని చేర్చు శీర్షిక పక్కన గుర్తులుగా ఉన్నాయి; జాబితాలో, మార్చేటప్పుడు సభ్యుల ఫోటో కనిపిస్తుంది.' },
      { en: 'Gallery and Reports use dropdowns. A report can be made for custom dates, from one day to another.', te: 'గ్యాలరీ, నివేదికలు డ్రాప్‌డౌన్లు వాడతాయి. ఒక తేదీ నుండి మరో తేదీ వరకు నచ్చిన తేదీలకు నివేదిక తయారు చేయవచ్చు.' },
      { en: 'Tap a member in Community, then Members, to open their card with a big picture, role, plots and mobile number. Pictures load faster, many at a time.', te: 'కమ్యూనిటీ, తర్వాత సభ్యులలో ఒక సభ్యుని నొక్కితే పెద్ద ఫోటో, పాత్ర, ప్లాట్లు, మొబైల్ నంబర్‌తో వారి కార్డు తెరుచుకుంటుంది. ఫోటోలు ఒకేసారి చాలా వేగంగా వస్తాయి.' },
      { en: 'What\'s new opens one release at a time and shows the time. The Change log names every action in plain words, and its filter icon has a label. My profile\'s details window shows your picture.', te: 'కొత్తగా ఏముంది ఒక్కో విడుదలను తెరిచి చూపుతుంది, సమయాన్ని కూడా చూపుతుంది. మార్పుల చిట్టా ప్రతి చర్యకు సాదా మాటల్లో పేరు ఇస్తుంది, దాని ఫిల్టర్ గుర్తుకు పేరు ఉంది. నా ప్రొఫైల్ వివరాల విండోలో మీ ఫోటో కనిపిస్తుంది.' },
    ] },
  { date: '2026-10-25', time: '02:00',
    title: { en: 'Faster screens, a tidier profile and change log', te: 'వేగవంతమైన స్క్రీన్‌లు, చక్కని ప్రొఫైల్, మార్పుల చిట్టా' },
    items: [
      { en: 'Screens and photos you have already opened show at once and are not fetched again until you press Sync or come back to the app. When you come back, Home refreshes and every other screen refreshes when you open it.', te: 'ఇప్పటికే తెరిచిన స్క్రీన్‌లు, ఫోటోలు వెంటనే కనిపిస్తాయి; సింక్ నొక్కే వరకు లేదా యాప్‌కు తిరిగి వచ్చే వరకు మళ్ళీ తేవబడవు. తిరిగి వచ్చినప్పుడు హోమ్ రిఫ్రెష్ అవుతుంది, మిగతా ప్రతి స్క్రీన్ తెరిచినప్పుడు రిఫ్రెష్ అవుతుంది.' },
      { en: 'My profile: the pencil beside the title opens a window to change your name, photo, Gmail or mobile. Home no longer repeats your name and plots.', te: 'నా ప్రొఫైల్: శీర్షిక పక్కన ఉన్న పెన్సిల్ నొక్కితే మీ పేరు, ఫోటో, Gmail లేదా మొబైల్ మార్చే విండో తెరుచుకుంటుంది. హోమ్‌లో మీ పేరు, ప్లాట్లు ఇక కనిపించవు.' },
      { en: 'Change log: entries open and close properly and start closed, the filters sit under a filter icon that turns bold while a filter is applied, and a contact change reads "Set Contact for" the member\'s name.', te: 'మార్పుల చిట్టా: నమోదులు సరిగ్గా తెరుచుకుని మూసుకుంటాయి, మొదట మూసి ఉంటాయి; ఫిల్టర్లు ఫిల్టర్ గుర్తు కింద ఉంటాయి, ఫిల్టర్ వర్తింపజేసినంతసేపు అది బోల్డ్‌గా కనిపిస్తుంది; సంప్రదింపు మార్పు సభ్యుని పేరుతో “సెట్ చేశారు” అని కనిపిస్తుంది.' },
    ] },
  { date: '2026-10-25', time: '00:27',
    title: { en: 'Sync button', te: 'సింక్ బటన్' },
    items: [
      { en: 'A Sync button at the top fetches the screen you are on again. Screens you have already opened are not fetched again when you move between tabs, so they open at once. Change the language in My profile.', te: 'పైన ఉన్న సింక్ బటన్ మీరు ఉన్న స్క్రీన్‌ను మళ్ళీ తెస్తుంది. ఒకసారి తెరిచిన స్క్రీన్‌లు ట్యాబ్‌లు మారినప్పుడు మళ్ళీ తేవబడవు, కాబట్టి అవి వెంటనే తెరుచుకుంటాయి. భాషను నా ప్రొఫైల్‌లో మార్చుకోండి.' },
      { en: 'When you come back to the app from another app or a locked phone, each screen fetches its data again when you open it, so you see current information.', te: 'మరో యాప్ నుండి లేదా లాక్ చేసిన ఫోన్ నుండి యాప్‌కు తిరిగి వచ్చినప్పుడు, ప్రతి స్క్రీన్ తెరిచినప్పుడు దాని డేటాను మళ్ళీ తెస్తుంది, కాబట్టి తాజా సమాచారం కనిపిస్తుంది.' },
    ] },
  { date: '2026-10-23',
    title: { en: 'Reports', te: 'నివేదికలు' },
    items: [
      { en: 'Download accounts, expenses, maintenance, payments, issues and meeting reports as Excel or PDF, for one month, the last 3 or 6 months, or the last year. The President decides who can download which report.', te: 'లెక్కలు, ఖర్చులు, నిర్వహణ, చెల్లింపులు, ఫిర్యాదులు, సమావేశాల నివేదికలను ఎక్సెల్ లేదా PDFగా డౌన్‌లోడ్ చేయండి: ఒక నెల, గత 3 లేదా 6 నెలలు, లేదా గత సంవత్సరం. ఏ నివేదికను ఎవరు డౌన్‌లోడ్ చేయవచ్చో అధ్యక్షులు నిర్ణయిస్తారు.' },
    ] },
  { date: '2026-10-22',
    title: { en: 'Stay signed in on your phone', te: 'ఫోన్‌లో సైన్ ఇన్ అయి ఉండండి' },
    items: [
      { en: 'The app now keeps you signed in for 30 days, also when added to the home screen. The Google sign-in button also looks right in dark mode.', te: 'యాప్ ఇప్పుడు 30 రోజులు సైన్ ఇన్ అయి ఉంచుతుంది, హోమ్ స్క్రీన్‌కు జోడించినప్పుడు కూడా. గూగుల్ సైన్ ఇన్ బటన్ డార్క్ మోడ్‌లో కూడా బాగా కనిపిస్తుంది.' },
    ] },
  { date: '2026-10-21',
    title: { en: 'Pending issues and the photo gallery', te: 'పెండింగ్ ఫిర్యాదులు, ఫోటో గ్యాలరీ' },
    items: [
      { en: 'Pending issues: see how many are open, in progress or waiting to be closed, and how long they have waited, on Home and in Issues.', te: 'పెండింగ్ ఫిర్యాదులు: ఎన్ని తెరిచి ఉన్నాయి, ఎన్ని జరుగుతున్నాయి, ఎన్ని మూసివేయడానికి వేచి ఉన్నాయి, ఎంతకాలంగా వేచి ఉన్నాయో హోమ్‌లో మరియు ఫిర్యాదులలో చూడండి.' },
      { en: 'Gallery: browse all photos and videos by events, meetings, issues and fixes, and filter by photos or videos and by month.', te: 'గ్యాలరీ: కార్యక్రమాలు, సమావేశాలు, ఫిర్యాదులు, సరిచేసినవి వారీగా అన్ని ఫోటోలు మరియు వీడియోలను చూడండి; ఫోటోలు లేదా వీడియోలు, నెల వారీగా వడపోయండి.' },
    ] },
  { date: '2026-10-20',
    title: { en: 'Your feedback: photos, rules, summaries and payments', te: 'మీ సూచనలు: ఫోటోలు, నియమాలు, సారాంశాలు, చెల్లింపులు' },
    items: [
      { en: 'Only the person who raised a complaint can close it, once it is resolved. They can reopen it if the problem is still there. If nobody closes it, it closes by itself after the number of hours the President sets.', te: 'ఫిర్యాదు చేసిన వ్యక్తి మాత్రమే, అది పరిష్కారమైన తర్వాత, దాన్ని మూసివేయగలరు. సమస్య ఇంకా ఉంటే మళ్లీ తెరవగలరు. ఎవరూ మూసివేయకపోతే, అధ్యక్షులు నిర్ణయించిన గంటల తర్వాత అదే మూసివేయబడుతుంది.' },
      { en: 'Your Google picture is now your profile photo. Change it any time from Profile with the camera or the gallery.', te: 'మీ గూగుల్ ఫోటో ఇప్పుడు మీ ప్రొఫైల్ ఫోటో. ప్రొఫైల్ నుండి కెమెరా లేదా గ్యాలరీతో ఎప్పుడైనా మార్చవచ్చు.' },
      { en: 'Take a photo or record a video with the camera wherever you add one: complaints, expenses, payments and events.', te: 'ఫిర్యాదులు, ఖర్చులు, చెల్లింపులు, కార్యక్రమాలలో ఫోటో లేదా వీడియో జోడించేటప్పుడు కెమెరాతో తీయవచ్చు.' },
      { en: 'Bylaws & rules: read the colony documents in the menu.', te: 'నియమాలు: మెనూలో కాలనీ పత్రాలను చదవండి.' },
      { en: 'Raising a complaint is now a floating + button, and the plot starts as your own and is chosen from a searchable list.', te: 'ఫిర్యాదు చేయడం ఇప్పుడు తేలియాడే + బటన్. ప్లాట్ మీ స్వంతదానితో మొదలై, వెతికే జాబితా నుండి ఎంచుకుంటారు.' },
      { en: 'Monthly summary of complaints, and monthly accounts of what was collected and spent.', te: 'ఫిర్యాదుల నెలవారీ సారాంశం, వసూలైనది మరియు ఖర్చు చేసినదాని నెలవారీ లెక్కలు.' },
      { en: 'My payments in Profile shows your payment history. The committee can see everyone\'s in Money.', te: 'ప్రొఫైల్‌లో నా చెల్లింపులు మీ చెల్లింపుల చరిత్రను చూపిస్తుంది. కమిటీ అందరివీ మనీలో చూడవచ్చు.' },
    ] },
  { date: '2026-10-19',
    title: { en: 'Welcome email for new members', te: 'కొత్త సభ్యులకు స్వాగత ఈమెయిల్' },
    items: [
      { en: 'Every new member now gets a welcome email with the app link, in English and Telugu.', te: 'ప్రతి కొత్త సభ్యునికి ఇప్పుడు యాప్ లింక్‌తో స్వాగత ఈమెయిల్ వస్తుంది, ఇంగ్లీష్ మరియు తెలుగులో.' },
      { en: 'After adding someone, the app tells you whether the email went out.', te: 'ఒకరిని చేర్చిన తర్వాత, ఈమెయిల్ వెళ్లిందో లేదో యాప్ చెబుతుంది.' },
      { en: 'For the best experience, open the app in Chrome and add it to your home screen.', te: 'ఉత్తమ అనుభవం కోసం, యాప్‌ను Chromeలో తెరిచి హోమ్ స్క్రీన్‌కు జోడించండి.' },
    ] },
  { date: '2026-10-18',
    title: { en: 'Who looks after a complaint, and who helped', te: 'ఫిర్యాదును ఎవరు చూసుకుంటారు, ఎవరు సహాయం చేశారు' },
    items: [
      { en: 'Committee members can take on a complaint nobody is looking after.', te: 'ఎవరూ చూసుకోని ఫిర్యాదును కమిటీ సభ్యులు తీసుకోవచ్చు.' },
      { en: 'Complaints can only be handed to committee members.', te: 'ఫిర్యాదులను కమిటీ సభ్యులకు మాత్రమే అప్పగించవచ్చు.' },
      { en: 'When resolving or closing, add photos of the fix and mark who helped.', te: 'పరిష్కరించేటప్పుడు లేదా మూసివేసేటప్పుడు, సరిచేసిన ఫోటోలు జోడించి, సహాయం చేసినవారిని గుర్తించండి.' },
      { en: 'The language switch now shows EN and తె.', te: 'భాష మార్పు ఇప్పుడు EN, తె అని చూపిస్తుంది.' },
    ] },
  { date: '2026-10-17', time: '15:42',
    title: { en: 'Videos, event spending and a new look', te: 'వీడియోలు, కార్యక్రమ ఖర్చులు, కొత్త రూపం' },
    items: [
      { en: 'Add a short video to an event or a complaint.', te: 'కార్యక్రమానికి లేదా ఫిర్యాదుకు చిన్న వీడియో జోడించండి.' },
      { en: 'Link an expense to an event and see what was spent on it.', te: 'ఖర్చును కార్యక్రమానికి జత చేసి, దానిపై ఎంత ఖర్చయిందో చూడండి.' },
      { en: 'The President can hand a complaint to someone to look after.', te: 'ఫిర్యాదును చూసుకోవడానికి అధ్యక్షుడు ఒకరికి అప్పగించవచ్చు.' },
      { en: 'Every screen is now in Telugu, and changing language is instant.', te: 'ప్రతి స్క్రీన్ ఇప్పుడు తెలుగులో ఉంది, భాష మార్పు వెంటనే జరుగుతుంది.' },
      { en: 'Our colony logo is in the header, and a new loading screen.', te: 'హెడర్‌లో మన కాలనీ లోగో, కొత్త లోడింగ్ స్క్రీన్.' },
    ] },
  { date: '2026-10-16',
    title: { en: 'Faster, installable app', te: 'వేగంగా, ఇన్‌స్టాల్ చేయదగిన యాప్' },
    items: [
      { en: 'Home and lists open much faster, and show what you saw last time while they refresh.', te: 'హోమ్, జాబితాలు చాలా వేగంగా తెరుచుకుంటాయి, రిఫ్రెష్ అవుతున్నప్పుడు గతంలో చూసినవి చూపిస్తాయి.' },
      { en: 'Install the app on your phone from the Help screen.', te: 'సహాయం స్క్రీన్ నుండి యాప్‌ను మీ ఫోన్‌లో ఇన్‌స్టాల్ చేయండి.' },
      { en: 'When a new version is ready, a bar offers an Update button.', te: 'కొత్త వెర్షన్ సిద్ధంగా ఉన్నప్పుడు, అప్‌డేట్ బటన్‌తో ఒక బార్ కనిపిస్తుంది.' },
      { en: 'Text follows your phone font size. Meetings now have a time.', te: 'అక్షరాల పరిమాణం మీ ఫోన్ సెట్టింగ్‌ను అనుసరిస్తుంది. సమావేశాలకు ఇప్పుడు సమయం ఉంటుంది.' },
      { en: 'The President can create roles, with one or several holders.', te: 'అధ్యక్షుడు పాత్రలను సృష్టించవచ్చు, ఒకరు లేదా ఎక్కువమంది హోల్డర్లతో.' },
    ] },
  { date: '2026-10-15',
    title: { en: 'The colony app is here', te: 'కాలనీ యాప్ వచ్చింది' },
    items: [
      { en: 'Sign in with Google. See the colony map and find any plot or member.', te: 'Googleతో సైన్ ఇన్ చేయండి. కాలనీ మ్యాప్‌లో ఏ ప్లాట్ లేదా సభ్యుడినైనా కనుగొనండి.' },
      { en: 'Raise complaints with photos and follow them stage by stage.', te: 'ఫోటోలతో ఫిర్యాదులు చేసి, దశలవారీగా అనుసరించండి.' },
      { en: 'See expenses, monthly maintenance and fees, and pay and confirm them.', te: 'ఖర్చులు, నెలవారీ నిర్వహణ, రుసుములు చూడండి; చెల్లించి నిర్ధారించండి.' },
      { en: 'Vote in polls, read meeting notes and action items, and see events.', te: 'పోల్స్‌లో ఓటు వేయండి, సమావేశ నోట్స్, చేయవలసిన పనులు, కార్యక్రమాలు చూడండి.' },
    ] },
];

// Newest release date; the menu shows a "New" mark until a member opens the page after it.
export const latestRelease = () => RELEASES[0]?.date || '';

// "What's new" entries, newest first. Member-facing wording: say what a member can now do, not how it works.
// Add an entry here for each release; `date` is the day it went live (YYYY-MM-DD).
export const RELEASES = [
  { date: '2026-10-18',
    title: { en: 'Who looks after a complaint, and who helped', te: 'ఫిర్యాదును ఎవరు చూసుకుంటారు, ఎవరు సహాయం చేశారు' },
    items: [
      { en: 'Committee members can take on a complaint nobody is looking after.', te: 'ఎవరూ చూసుకోని ఫిర్యాదును కమిటీ సభ్యులు తీసుకోవచ్చు.' },
      { en: 'Complaints can only be handed to committee members.', te: 'ఫిర్యాదులను కమిటీ సభ్యులకు మాత్రమే అప్పగించవచ్చు.' },
      { en: 'When resolving or closing, add photos of the fix and mark who helped.', te: 'పరిష్కరించేటప్పుడు లేదా మూసివేసేటప్పుడు, సరిచేసిన ఫోటోలు జోడించి, సహాయం చేసినవారిని గుర్తించండి.' },
      { en: 'The language switch now shows EN and తె.', te: 'భాష మార్పు ఇప్పుడు EN, తె అని చూపిస్తుంది.' },
    ] },
  { date: '2026-10-17',
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

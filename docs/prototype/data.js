// TRUE Path Navigator — mock data for the prototype.
// In production these come from the backend. Here we hand-curate
// plausible content for a realistic walkthrough.

window.TPN_DATA = (function () {
  const seedQuestions = [
    {
      id: 'situation',
      title: 'Which best describes where you are right now?',
      hint: 'No wrong answer — this just helps us start in the right place.',
      layout: 'column',
      options: [
        { id: 'changer',   label: 'Changing careers from another industry' },
        { id: 'returning', label: 'Returning to work after a break' },
        { id: 'young',     label: 'Just starting out or in school' },
        { id: 'displaced', label: 'Recently laid off or between jobs' },
        { id: 'advancing', label: 'Already in healthcare, looking to advance' },
        { id: 'newcomer',  label: 'Newly arrived in the U.S.' },
      ],
    },
    {
      id: 'education',
      title: 'What is your highest level of education?',
      hint: 'A GED works the same as a high-school diploma for most pathways.',
      layout: 'wrap',
      options: [
        { id: 'none',    label: 'No diploma yet' },
        { id: 'hs',      label: 'High school / GED' },
        { id: 'some',    label: 'Some college' },
        { id: 'aa',      label: 'Associate degree' },
        { id: 'ba',      label: 'Bachelor\u2019s degree' },
        { id: 'grad',    label: 'Graduate degree' },
        { id: 'intl',    label: 'Degree earned outside the U.S.' },
      ],
    },
    {
      id: 'timeframe',
      title: 'How soon do you want to be working?',
      hint: 'Some roles start in weeks; others take years.',
      layout: 'wrap',
      options: [
        { id: '3m',  label: 'Within 3 months' },
        { id: '6m',  label: '3 to 6 months' },
        { id: '12m', label: '6 to 12 months' },
        { id: '2y',  label: '1 to 2 years' },
        { id: 'open',label: 'Open — willing to train longer' },
      ],
    },
    {
      id: 'schedule',
      title: 'When can you realistically attend training?',
      hint: 'Pick all that apply.',
      multi: true,
      layout: 'wrap',
      options: [
        { id: 'days',     label: 'Weekday daytime' },
        { id: 'evenings', label: 'Weekday evenings' },
        { id: 'weekends', label: 'Weekends' },
        { id: 'online',   label: 'Online / asynchronous' },
        { id: 'hybrid',   label: 'Hybrid' },
      ],
    },
    {
      id: 'environment',
      title: 'What kind of work feels most like you?',
      hint: 'Trust your gut — this shapes the kind of pathway we recommend, not the only one.',
      layout: 'column',
      options: [
        { id: 'bedside', label: 'Hands-on care with patients' },
        { id: 'tech',    label: 'Working with equipment, samples, or data' },
        { id: 'admin',   label: 'Coordinating, scheduling, helping the system run' },
        { id: 'mh',      label: 'Behavioral health, counseling, social support' },
        { id: 'mix',     label: 'A mix — I want to see options' },
      ],
    },
    {
      id: 'support',
      title: 'Do you have any of these in place?',
      hint: 'Pick any that apply — including “None of these yet.”',
      multi: true,
      layout: 'wrap',
      options: [
        { id: 'childcare', label: 'Reliable childcare' },
        { id: 'transit',   label: 'Car or transit access' },
        { id: 'wioa',      label: 'WIOA / workforce funding' },
        { id: 'esl',       label: 'ESL support / translation' },
        { id: 'none',      label: 'None of these yet' },
      ],
    },
    {
      id: 'location',
      title: 'Where in the region are you based?',
      hint: 'We tailor program and employer recommendations to your area.',
      layout: 'wrap',
      options: [
        { id: 'seattle',   label: 'Seattle / Central' },
        { id: 'north',     label: 'North King (Shoreline, Bothell, Kirkland)' },
        { id: 'eastside',  label: 'Eastside (Bellevue, Redmond, Issaquah)' },
        { id: 'south',     label: 'South King (Renton, Kent, Federal Way, Auburn)' },
        { id: 'pierce',    label: 'Pierce or Snohomish County' },
        { id: 'elsewhere', label: 'Elsewhere in Washington' },
      ],
    },
  ];

  // Fake AI follow-up sequence — the prototype rotates through these
  // after the 7 seed questions to demo the dynamic feel.
  const followups = [
    {
      id: 'fu_caregiving',
      title: 'Have you done caregiving before — paid or unpaid?',
      rationale: 'You mentioned returning to work and a preference for hands-on roles. Caregiving experience opens up faster pathways.',
      layout: 'wrap',
      options: [
        { id: 'paid',     label: 'Yes — paid (home health, CNA, etc.)' },
        { id: 'family',   label: 'Yes — for a family member' },
        { id: 'volunteer',label: 'Yes — volunteer or informal' },
        { id: 'no',       label: 'No, not really' },
      ],
    },
    {
      id: 'fu_priorities',
      title: 'What matters most in your next job?',
      rationale: 'Your answers suggest stability is a factor. Let\u2019s confirm what to optimize for.',
      multi: true,
      layout: 'wrap',
      options: [
        { id: 'income',     label: 'Steady income' },
        { id: 'benefits',   label: 'Health benefits' },
        { id: 'schedule',   label: 'Predictable schedule' },
        { id: 'growth',     label: 'Room to advance' },
        { id: 'meaning',    label: 'Helping people directly' },
      ],
    },
  ];

  // Skills inferred from intake. Each carries a brief "where it came from" line.
  const skillsCatalog = [
    { id: 'listening',  label: 'Active listening',         sub: 'from caregiving + customer-facing work' },
    { id: 'comm',       label: 'Patient-style communication', sub: 'inferred from your service background' },
    { id: 'time',       label: 'Time management',          sub: 'from balancing multiple responsibilities' },
    { id: 'safety',     label: 'Safety & hygiene awareness',sub: 'common across caregiving roles' },
    { id: 'doc',        label: 'Documentation & follow-through', sub: 'transfers from admin / retail' },
    { id: 'empathy',    label: 'Empathy under pressure',   sub: 'core to your stated priorities' },
    { id: 'team',       label: 'Team coordination',        sub: 'from shift-based work' },
    { id: 'multitask',  label: 'Multitasking calmly',      sub: 'from prior fast-paced environments' },
    { id: 'deescalate', label: 'De-escalation',            sub: 'from front-line interactions' },
    { id: 'vitals',     label: 'Basic vital-signs concept',sub: 'foundational — you can build on it' },
    { id: 'tech',       label: 'Comfort with simple tech', sub: 'inferred from intake responses' },
    { id: 'bilingual',  label: 'Bilingual communication',  sub: 'high value in WA healthcare settings' },
  ];

  // Three ranked pathways with realistic WA wage / ladder data
  const pathways = [
    {
      id: 'cna-rn',
      rank: 1,
      featured: true,
      title: 'CNA \u2192 LPN \u2192 RN',
      sub: 'Stackable nursing pathway. Start in 6\u201312 weeks, advance over 2\u20134 years.',
      wageRange: '$22 \u2013 $52 / hr',
      wageNote: 'King County, May 2026',
      confidence: 4,
      tags: [
        { label: 'WIOA eligible', tone: 'sage' },
        { label: 'Evening classes', tone: '' },
        { label: 'Short start (6 wks)', tone: 'amber' },
        { label: 'High demand', tone: 'sage' },
      ],
      ladder: [
        { role: 'CNA', meta: '6\u201312 weeks · Entry', current: true },
        { role: 'LPN', meta: '12\u201318 months' },
        { role: 'RN (ADN)', meta: '2\u20133 years' },
      ],
      why: 'You can start earning as a CNA inside three months while your caregiving experience is recognized. Evening LPN bridge programs at Renton Technical College and Bates Tech let you stack credentials without leaving your job. Statewide nursing shortage means hiring momentum is strong.',
    },
    {
      id: 'ma-clinical',
      rank: 2,
      title: 'Medical Assistant \u2192 Specialty MA',
      sub: 'Clinic-based role with predictable hours, no nights. Stackable into specialty work.',
      wageRange: '$24 \u2013 $34 / hr',
      wageNote: 'King County, May 2026',
      confidence: 3,
      tags: [
        { label: 'Daytime hours', tone: 'sage' },
        { label: 'Hybrid program', tone: '' },
        { label: 'WIOA eligible', tone: 'sage' },
        { label: '9\u201312 month training', tone: '' },
      ],
      ladder: [
        { role: 'MA (certified)', meta: '9\u201312 months · Entry', current: true },
        { role: 'Specialty MA', meta: '+6 months' },
        { role: 'Clinical lead', meta: '2\u20134 years' },
      ],
      why: 'Your scheduling preference for weekday daytime and your administrative comfort make a clinic-based MA role a clean fit. Highline College and Pima Medical Institute both run hybrid cohorts with rolling starts. Specialty MA (cardiology, derm) lifts pay meaningfully without further degree.',
    },
    {
      id: 'phleb',
      rank: 3,
      title: 'Phlebotomy / Patient Care Tech',
      sub: 'Fastest entry. Strong fit if you want to be in healthcare in under 8 weeks.',
      wageRange: '$21 \u2013 $28 / hr',
      wageNote: 'King County, May 2026',
      confidence: 3,
      tags: [
        { label: 'Fastest start', tone: 'amber' },
        { label: '4\u20138 wk training', tone: '' },
        { label: 'Hospital + lab', tone: '' },
      ],
      ladder: [
        { role: 'Phlebotomist', meta: '4\u20138 weeks · Entry', current: true },
        { role: 'PCT', meta: '+8\u201312 weeks' },
        { role: 'Lab tech (AAS)', meta: '2 years' },
      ],
      why: 'If "soon" matters most, this is the shortest path to a real healthcare badge. Less direct patient time than nursing, more procedural focus. A good bridge if you want to test the environment before committing to a longer program.',
    },
  ];

  const limitations = {
    headline: 'A few honest limits to plan around',
    summary:
      'Based on your answers, here\u2019s what to keep in mind. None of these block the pathways below — they shape the order and timing.',
    bullets: [
      'Daytime-only programs may not fit if you keep a current job; evening LPN options are flagged on Pathway 1.',
      'Funding eligibility (WIOA) must be confirmed with a case manager — we cannot verify it inside this tool.',
      'Internationally earned credentials may need evaluation through CGFNS before nursing licensure.',
      'Wages shown are King County averages. Rural-WA wages run 8\u201312% lower for the same roles.',
    ],
  };

  return { seedQuestions, followups, skillsCatalog, pathways, limitations };
})();

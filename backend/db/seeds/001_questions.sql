-- Seed: 7 intake seed questions with answer choices

INSERT INTO questions (id, title, hint, is_multi, layout, display_order, question_type) VALUES
  ('situation', 'Which best describes where you are right now?',            'No wrong answer — this just helps us start in the right place.', FALSE, 'column', 1, 'seed'),
  ('education', 'What is your highest level of education?',                 'A GED works the same as a high-school diploma for most pathways.',  FALSE, 'wrap',   2, 'seed'),
  ('timeframe', 'How soon do you want to be working?',                      'Some roles start in weeks; others take years.',                      FALSE, 'wrap',   3, 'seed'),
  ('schedule',  'When can you realistically attend training?',              'Pick all that apply.',                                               TRUE,  'wrap',   4, 'seed'),
  ('environment','What kind of work feels most like you?',                  'Trust your gut — this shapes the kind of pathway we recommend, not the only one.', FALSE, 'column', 5, 'seed'),
  ('support',   'Do you have any of these in place?',                       'Pick any that apply — including "None of these yet."',               TRUE,  'wrap',   6, 'seed'),
  ('location',  'Where in the region are you based?',                      'We tailor program and employer recommendations to your area.',        FALSE, 'wrap',   7, 'seed')
ON CONFLICT (id) DO NOTHING;

INSERT INTO question_choices (question_id, option_key, label, display_order) VALUES
  ('situation', 'changer',   'Changing careers from another industry',          1),
  ('situation', 'returning', 'Returning to work after a break',                 2),
  ('situation', 'young',     'Just starting out or in school',                  3),
  ('situation', 'displaced', 'Recently laid off or between jobs',               4),
  ('situation', 'advancing', 'Already in healthcare, looking to advance',       5),
  ('situation', 'newcomer',  'Newly arrived in the U.S.',                       6),

  ('education', 'none', 'No diploma yet',                  1),
  ('education', 'hs',   'High school / GED',               2),
  ('education', 'some', 'Some college',                     3),
  ('education', 'aa',   'Associate degree',                 4),
  ('education', 'ba',   'Bachelor''s degree',               5),
  ('education', 'grad', 'Graduate degree',                  6),
  ('education', 'intl', 'Degree earned outside the U.S.',  7),

  ('timeframe', '3m',   'Within 3 months',           1),
  ('timeframe', '6m',   '3 to 6 months',             2),
  ('timeframe', '12m',  '6 to 12 months',            3),
  ('timeframe', '2y',   '1 to 2 years',              4),
  ('timeframe', 'open', 'Open — willing to train longer', 5),

  ('schedule', 'days',     'Weekday daytime',          1),
  ('schedule', 'evenings', 'Weekday evenings',         2),
  ('schedule', 'weekends', 'Weekends',                 3),
  ('schedule', 'online',   'Online / asynchronous',   4),
  ('schedule', 'hybrid',   'Hybrid',                  5),

  ('environment', 'bedside', 'Hands-on care with patients',                         1),
  ('environment', 'tech',    'Working with equipment, samples, or data',             2),
  ('environment', 'admin',   'Coordinating, scheduling, helping the system run',     3),
  ('environment', 'mh',      'Behavioral health, counseling, social support',        4),
  ('environment', 'mix',     'A mix — I want to see options',                        5),

  ('support', 'childcare', 'Reliable childcare',        1),
  ('support', 'transit',   'Car or transit access',     2),
  ('support', 'wioa',      'WIOA / workforce funding',  3),
  ('support', 'esl',       'ESL support / translation', 4),
  ('support', 'none',      'None of these yet',         5),

  ('location', 'seattle',   'Seattle / Central',                              1),
  ('location', 'north',     'North King (Shoreline, Bothell, Kirkland)',       2),
  ('location', 'eastside',  'Eastside (Bellevue, Redmond, Issaquah)',          3),
  ('location', 'south',     'South King (Renton, Kent, Federal Way, Auburn)', 4),
  ('location', 'pierce',    'Pierce or Snohomish County',                     5),
  ('location', 'elsewhere', 'Elsewhere in Washington',                        6)
ON CONFLICT (question_id, option_key) DO NOTHING;

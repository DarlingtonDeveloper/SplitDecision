-- Demo beats for hackathon (swap audio_url + embedding after pre-bake)
insert into beats (title, bpm, music_key, mood_tags, genre, reference_artists, license_tiers, status)
values
  ('Midnight', 140, 'F# minor', array['dark','atmospheric','trap'], 'trap', array['Travis Scott','Don Toliver'], '{"lease": 500, "exclusive": 2500, "points": 3}', 'available'),
  ('Nebula', 138, 'A minor', array['spacey','moody','bouncy'], 'trap', array['Travis Scott','Metro Boomin'], '{"lease": 450, "exclusive": 2000, "points": 3}', 'available'),
  ('Afterhours', 142, 'C minor', array['nocturnal','hard','distorted'], 'trap', array['Future','Young Thug'], '{"lease": 400, "exclusive": 1800, "points": 2}', 'available');

-- Party packages (from the Romeo Lane Nagpur party package deck). Rates are per guest, before taxes.
insert into public.packages (id, name, rate, royal_dishes, sort, bar) values
('deluxe','Deluxe',2200,false,1,'[["Bar","Mocktails and aerated beverages"]]'),
('blended','Blended',4200,false,2,'[["Whisky","JW Blonde or JNB Rare"],["Vodka","Skyy, Smirnoff or equivalent"],["Gin","Greater Than, Gordon''s or equivalent"],["Rum","Bacardi, Old Monk or equivalent"],["Beer","Kingfisher Ultra, Budweiser or RL draught"]]'),
('royal','Royal',5200,true,3,'[["Whisky","JW Black Label, Chivas 12 or equivalent"],["Vodka","Absolut, Ketel One or equivalent"],["Gin","Greater Than, Gordon''s or equivalent"],["Rum","Bacardi, Old Monk or equivalent"],["Beer","Kingfisher Ultra, Budweiser or RL draught"],["Wine","House red and white"]]'),
('premium','Premium',6200,false,4,'[["Whisky","JW Black Label, Chivas 12, Jack Daniel''s or equivalent"],["Single malt","Glenlivet 12, Glenfiddich 12 or equivalent"],["Vodka","Grey Goose, Belvedere or equivalent"],["Gin","Tanqueray, Bombay Sapphire or equivalent"],["Rum","Bacardi, Old Monk or equivalent"],["Beer","Imported beers"],["Wine","Imported house wine"]]'),
('platinum','Platinum',7200,true,5,'[["Whisky","Gold Label, Chivas 18 or equivalent"],["Single malt","Glenlivet 18, Glenfiddich 18 or equivalent"],["Vodka","Cîroc, Grey Goose or equivalent"],["Gin","Roku, Monkey 47 or equivalent"],["Beer","Imported beer or RL draught"],["Wine","Premium imported wines"]]')
on conflict (id) do update set name=excluded.name, rate=excluded.rate, bar=excluded.bar, royal_dishes=excluded.royal_dishes, sort=excluded.sort;

-- Sample events and offers, marked sample. Replace them from the staff console.
insert into public.events (title, kind, date, time, price, guestlist, cutoff, blurb, sample) values
('Lane After Dark: Halloween','Festive','2026-10-31','Doors 8 PM',1500,true,'10:30 PM','Costumes, a DJ until close and themed cocktails. Cover redeemable against food and drink.',true),
('Sundowner Sessions','Live music','2026-11-01','5:30 PM – 9 PM',0,false,'','An acoustic duo plays through sunset. Walk in or reserve a table.',true),
('Ladies'' Night','Ladies night','2026-11-04','Doors 8 PM',0,true,'10:30 PM','Welcome drinks for ladies on the guestlist.',true),
('Diwali Night at the Lane','Festive','2026-11-07','Doors 8 PM',2000,true,'10 PM','A festive menu, card tables and a Bollywood DJ on the eve of Diwali.',true);

insert into public.offers (title, detail, when_text, members_only, sort, sample) values
('Happy hours','1+1 on select cocktails and beer.','Daily · 12 – 7 PM',false,1,true),
('Double points weekdays','Earn 2 points per ₹10 on bills settled Monday to Thursday.','Mon – Thu',true,2,true),
('Birthday dessert','A dessert in your birthday month. Show your Lane Club card.','Birthday month',true,3,true),
('Tables of eight or more','A platter for the table on parties of eight or more.','Sun – Thu',false,4,true);

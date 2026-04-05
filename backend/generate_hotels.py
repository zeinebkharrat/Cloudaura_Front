import random
import json

cities = [
    (1, 'Tunis'), (2, 'Ariana'), (3, 'Ben Arous'), (4, 'Manouba'), (5, 'Nabeul'), (6, 'Zaghouan'),
    (7, 'Bizerte'), (8, 'Beja'), (9, 'Jendouba'), (10, 'Le Kef'), (11, 'Siliana'), (12, 'Kairouan'),
    (13, 'Kasserine'), (14, 'Sidi Bouzid'), (15, 'Sousse'), (16, 'Monastir'), (17, 'Mahdia'), (18, 'Sfax'),
    (19, 'Gafsa'), (20, 'Tozeur'), (21, 'Kebili'), (22, 'Gabes'), (23, 'Medenine'), (24, 'Tataouine')
]

names_5 = {
    'Tunis': ['Movenpick Tunis', 'Four Seasons Tunis', 'Sheraton Tunis', 'Laico Tunis', 'The Residence Tunis'],
    'Ariana': ['Radisson Blu Tunis Airport', 'Golden Tulip Carthage Tunis', 'El Mouradi Palace', 'Hasdrubal Prestige Ariana', 'Concorde Hotel Tunis'],
    'Ben Arous': ['Holiday Inn Tunis', 'Ibis Styles Tunis', 'Ramada Tunis', 'Golden Jasmine Tunis', 'City Centre Tunis'],
    'Manouba': ['Dar Ben Gacem', 'Villa Didon Manouba', 'Hotel Royal Manouba', 'Chateau Blanc', 'El Wafa Hotel'],
    'Nabeul': ['La Badira Hammamet', 'Iberostar Averroes', 'Novotel Hammamet', 'The Sindbad Hammamet', 'Bel Azur Hammamet'],
    'Zaghouan': ['Dar Zaghouan', 'Hotel Nymphes', 'Villa Romaine Zaghouan', 'Le Temple Zaghouan', 'Panorama Zaghouan'],
    'Bizerte': ['Le Petit Mousse Bizerte', 'Corniche Hotel Bizerte', 'Nour Palace Bizerte', 'Hotel Jalta Bizerte', 'Dar Zarrouk Bizerte'],
    'Beja': ['Hotel Beja Center', 'Dar El Ain Beja', 'Hotel Royal Beja', 'Le Nour Beja', 'Vagues Hotel Beja'],
    'Jendouba': ['Dar Ismail Tabarka', 'Golf Beach Tabarka', 'Hotel de France Tabarka', 'Mimosas Tabarka', 'Abou Nawas Tabarka'],
    'Le Kef': ['Hotel Medina Kef', 'Dar Kef', 'L Auberge Kef', 'Hotel Venus Kef', 'Hotel de la Paix Kef'],
    'Siliana': ['Hotel Central Siliana', 'Dar Siliana', 'Hotel du Sud Siliana', 'Makthar Inn', 'Le Relais Siliana'],
    'Kairouan': ['Amina Hotel Kairouan', 'Continental Kairouan', 'Dar El Medina Kairouan', 'Hotel Splendid Kairouan', 'La Kasbah Kairouan'],
    'Kasserine': ['El Ghorfa Kasserine', 'Hotel Cillium Kasserine', 'Hotel Pinus Kasserine', 'Dar Chambi Kasserine', 'Hotel Atlas Kasserine'],
    'Sidi Bouzid': ['Hotel Sidi Bouzid', 'Dar El Wafa', 'Hotel le Renouveau', 'Oasis Hotel Sidi Bouzid', 'Hotel El Fadl'],
    'Sousse': ['Movenpick Sousse', 'El Mouradi Sousse', 'Marhaba Palace Sousse', 'Hasdrubal Prestige Sousse', 'Iberostar Sousse Beach'],
    'Monastir': ['Iberostar Monastir', 'Club Palm Azur Monastir', 'Regency Hotel Monastir', 'Residence Monastir', 'Riu Palace Monastir'],
    'Mahdia': ['Club Eldorador Mahdia', 'Abou Nawas Mahdia', 'Yadis Mahdia Golf', 'Monica Hotel Mahdia', 'Thalassa Mahdia'],
    'Sfax': ['Novotel Sfax Centre', 'Movenpick Sfax', 'Hotel Sfax Centre', 'Les Oliviers Sfax', 'Thyna Hotel Sfax'],
    'Gafsa': ['Gafsa Palace Hotel', 'Hotel Maamoun Gafsa', 'Hotel Khalfallah Gafsa', 'Grand Hotel Gafsa', 'Dar Gafsa'],
    'Tozeur': ['Dar Horchani Tozeur', 'Yadis Ksar Dghara', 'Movenpick Tozeur', 'Ksar El Ain Tozeur', 'Four Seasons Desert Tozeur'],
    'Kebili': ['Dar Kebili', 'Hotel Kebili', 'Oasis Palace Kebili', 'Le Sahara Kebili', 'Hotel du Desert Kebili'],
    'Gabes': ['Club Kanta Gabes', 'Hotel Chems Gabes', 'Hotel Atlantic Gabes', 'Dar Ben Gabes', 'Oasis Hotel Gabes'],
    'Medenine': ['Hotel Sangho Djerba', 'Radisson Blu Djerba', 'Hasdrubal Djerba', 'Melia Djerba', 'Ulysse Palace Djerba'],
    'Tataouine': ['Ksar Ouled Soltane Hotel', 'Sangho Tataouine', 'Hotel Hamza Tataouine', 'Dar Ain Tataouine', 'Le Relais Tataouine']
}

ratings_by_hotel = {
    'Movenpick': 5.0, 'Four Seasons': 5.0, 'Sheraton': 4.5, 'Laico': 4.5, 'The Residence': 5.0,
    'Radisson': 4.5, 'Golden Tulip': 4.0, 'El Mouradi': 4.0, 'Hasdrubal': 4.5, 'Concorde': 4.0,
    'Iberostar': 4.5, 'Novotel': 4.0, 'Riu': 4.5, 'La Badira': 5.0, 'Marhaba': 4.0,
    'Yadis': 4.0, 'Club': 3.5, 'Dar': 3.5, 'Hotel': 3.0, 'Le': 3.5, 'Oasis': 3.0,
}

prices_by_rating = {5.0: (350, 600), 4.5: (200, 350), 4.0: (140, 200), 3.5: (90, 140), 3.0: (60, 90)}

random.seed(99)
sql_lines = ['-- 5 Hotels per each of the 24 Tunisian governorates (120 total)\n']
json_data = []
types_available = ['HOTEL', 'HOTEL', 'HOTEL', 'MAISON_HOTE', 'GUESTHOUSE']

for cid, cname in cities:
    hotel_list = names_5.get(cname, [cname + ' Grand Hotel', cname + ' Palace', cname + ' Oasis', 'Dar ' + cname, cname + ' Resort'])
    for idx, hotel_name in enumerate(hotel_list[:5]):
        # determine rating from name
        rating = 3.0
        for prefix, r in ratings_by_hotel.items():
            if hotel_name.startswith(prefix):
                rating = r
                break
        
        pmin, pmax = prices_by_rating.get(rating, (80, 150))
        price = round(random.uniform(pmin, pmax), 2)
        
        a_type = types_available[idx % len(types_available)]
        if 'Dar ' in hotel_name:
            a_type = 'MAISON_HOTE'
        
        safe_name = hotel_name.replace("'", "''")
        sql_lines.append(
            f"INSERT INTO accommodations (name, type, price_per_night, rating, status, city_id) "
            f"VALUES ('{safe_name}', '{a_type}', {price}, {rating}, 'AVAILABLE', {cid});"
        )
        json_data.append({
            "name": hotel_name, "type": a_type,
            "pricePerNight": price, "rating": rating,
            "status": "AVAILABLE", "city_id": cid, "city": cname
        })

with open('C:/Users/Salim/Cloudaura_Front/backend/hotels.sql', 'w', encoding='utf-8') as f:
    f.write('\n'.join(sql_lines))

with open('C:/Users/Salim/Cloudaura_Front/backend/hotels.json', 'w', encoding='utf-8') as f:
    json.dump(json_data, f, indent=2, ensure_ascii=False)

print(f'OK - Generated {len(json_data)} hotels for {len(cities)} cities')

-- Seed inicial de títulos
INSERT INTO title (id, name, kind, genre, year, duration_minutes, rating, watched, notes) VALUES
(1,  'Interestelar',                              'movie',  'ficção científica', 2014, 169, 9.0, true,  'Filme do Christopher Nolan'),
(2,  'Breaking Bad',                              'series', 'drama',             2008, 49,  9.5, true,  'Série completa, 5 temporadas'),
(3,  'O Senhor dos Anéis: A Sociedade do Anel',   'movie',  'fantasia',          2001, 178, 9.2, true,  'Trilogia épica'),
(4,  'Stranger Things',                           'series', 'ficção científica', 2016, 51,  8.7, false, 'Faltam as duas últimas temporadas'),
(5,  'Pulp Fiction',                              'movie',  'crime',             1994, 154, 8.9, true,  'Tarantino clássico'),
(6,  'The Office (US)',                           'series', 'comédia',           2005, 22,  8.8, true,  'Re-assistido várias vezes'),
(7,  'Duna: Parte Dois',                          'movie',  'ficção científica', 2024, 166, 8.5, false, 'Quero assistir no cinema'),
(8,  'Chernobyl',                                 'series', 'drama',             2019, 70,  9.4, true,  'Minissérie da HBO'),
(9,  'A Origem',                                  'movie',  'ficção científica', 2010, 148, 8.8, true,  'Nolan novamente'),
(10, 'Friends',                                   'series', 'comédia',           1994, 22,  8.4, false, 'Clássico, ainda não assisti'),
(11, 'O Poderoso Chefão',                         'movie',  'crime',             1972, 175, 9.2, false, 'Lista de "preciso assistir"'),
(12, 'Game of Thrones',                           'series', 'fantasia',          2011, 57,  8.5, true,  'Apesar do final')
ON CONFLICT (id) DO NOTHING

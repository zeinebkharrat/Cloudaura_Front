-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Apr 26, 2026 at 03:15 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `yallatn`
--

-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- Table structure for table `badges`
--

CREATE TABLE `badges` (
  `badge_id` int(11) NOT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `description` varchar(2000) DEFAULT NULL,
  `icon_url` varchar(1000) DEFAULT NULL,
  `name` varchar(200) NOT NULL,
  `target_game_id` varchar(100) DEFAULT NULL,
  `target_game_kind` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `badges`
--

INSERT INTO `badges` (`badge_id`, `created_at`, `description`, `icon_url`, `name`, `target_game_id`, `target_game_kind`) VALUES
(6, '2026-04-26 10:41:43.000000', 'aaaaaaaaa', '/uploads/products/d66018e6-8037-4fb3-a821-9be3229fde99.jpeg', 'aaaaaa', '1', 'CHKOBBA'),
(7, '2026-04-26 10:58:11.000000', 'zaeazeaze', '/uploads/products/8c96077e-2c85-4527-bd20-863f0d48cc9e.jpeg', 'aazezae', '2', 'CHEF_QUEST');

-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- Table structure for table `cooking_ingredients`
--

CREATE TABLE `cooking_ingredients` (
  `id` bigint(20) NOT NULL,
  `icon_url` varchar(255) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `x` double NOT NULL,
  `y` double NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `cooking_ingredients`
--

INSERT INTO `cooking_ingredients` (`id`, `icon_url`, `name`, `x`, `y`) VALUES
(1, 'assets/images/flour.png', 'Flour', 75, 35),
(2, 'assets/images/sugar.png', 'Sugar', 85, 35),
(3, 'assets/images/eggs.png', 'Eggs', 25, 75),
(4, 'assets/images/milk.png', 'Milk', 35, 75),
(6, '/uploads/profile-images/59e4d5dc-3a94-4d4b-9c23-2bb6ceef9591.jpeg', 'Harissa ', 50, 50),
(7, '/uploads/profile-images/a27ad89a-340d-4b7f-b668-99b2ae624778.jpeg', 'Tmamen sicam', 50, 50),
(8, '/uploads/profile-images/9d2c087c-520f-497d-997e-ca3a7b56c81f.jpeg', 'Felfel', 50, 50),
(9, '/uploads/profile-images/1baa5990-f949-45af-812a-e80221f3d166.jpeg', 'Tmatem k3ab', 50, 50),
(10, '/uploads/profile-images/01d33f2d-c6fa-4377-87e8-1e5254304268.jpeg', 'batata', 50, 50);

-- --------------------------------------------------------

--
-- Table structure for table `crosswords`
--

CREATE TABLE `crosswords` (
  `crossword_id` int(11) NOT NULL,
  `published` bit(1) DEFAULT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  `grid_json` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `crosswords`
--

INSERT INTO `crosswords` (`crossword_id`, `published`, `created_at`, `description`, `title`, `grid_json`) VALUES
(1, b'1', '2026-03-25 14:40:39.000000', 'decouvrir les states', 'states', '{\"rows\":10,\"cols\":10,\"words\":[{\"word\":\"tunis\",\"clue\":\"la capitale\",\"x\":0,\"y\":0,\"dir\":\"H\"},{\"word\":\"tataouine\",\"clue\":\"star wars\",\"x\":0,\"y\":0,\"dir\":\"V\"},{\"word\":\"nabeul\",\"clue\":\"hrissa\",\"x\":0,\"y\":2,\"dir\":\"V\"},{\"word\":\"tabarka\",\"clue\":\"village dans jendouba \",\"x\":2,\"y\":0,\"dir\":\"H\"}]}'),
(2, b'0', '2026-03-28 18:26:37.000000', 'azeaze', 'azea', '{\"rows\":10,\"cols\":10,\"words\":[{\"word\":\"azeaz\",\"clue\":\"azezea\",\"x\":0,\"y\":0,\"dir\":\"H\"}]}');

-- --------------------------------------------------------

--
-- Table structure for table `daily_challenges`
--

CREATE TABLE `daily_challenges` (
  `challenge_id` int(11) NOT NULL,
  `active` bit(1) NOT NULL,
  `description` varchar(2000) DEFAULT NULL,
  `game_kind` varchar(50) NOT NULL,
  `points_reward` int(11) NOT NULL,
  `target_id` int(11) DEFAULT NULL,
  `title` varchar(300) NOT NULL,
  `valid_from` datetime(6) DEFAULT NULL,
  `valid_to` datetime(6) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `daily_challenges`
--

INSERT INTO `daily_challenges` (`challenge_id`, `active`, `description`, `game_kind`, `points_reward`, `target_id`, `title`, `valid_from`, `valid_to`) VALUES
(1, b'1', 'goooo', 'QUIZ', 10, 7, 'go get it', '2026-04-06 22:04:55.000000', '2026-04-07 22:04:55.000000'),
(2, b'1', 'Test your knowledge of Tunisia by answering 5 questions about its history, culture, and geography correctly to earn your points.', 'QUIZ', 30, NULL, 'Tunisian Explorer', '2026-04-23 21:12:18.000000', '2026-04-24 21:12:18.000000'),
(3, b'1', 'Test your knowledge of Tunisia\'s history, culture, and landmarks by answering 5 quiz questions correctly to earn your badges and points.', 'QUIZ', 30, 8, 'Tunisian Explorer', '2026-04-23 21:20:09.000000', '2026-04-24 21:20:09.000000'),
(6, b'1', 'Test your knowledge of Tunisia by answering 5 questions about its history, culture, and landmarks, and get at least 4 correct to earn the reward.', 'QUIZ', 30, NULL, 'Tunisian Explorer', '2026-04-26 11:02:44.000000', '2026-04-27 11:02:44.000000'),
(7, b'1', 'Answer 5 questions about Tunisia\'s history, culture, and geography to test your knowledge and earn rewards.', 'QUIZ', 30, NULL, 'Tunisian Explorer', '2026-04-26 11:06:10.000000', '2026-04-27 11:06:10.000000'),
(8, b'1', 'Test your knowledge of Tunisia\'s history, culture, and landmarks by answering 5 quiz questions correctly to unlock your reward.', 'QUIZ', 30, NULL, 'Tunisian Treasure', '2026-04-26 11:10:25.000000', '2026-04-27 11:10:25.000000'),
(9, b'1', 'Test your knowledge of Tunisia\'s history, culture, and landmarks by answering 5 quiz questions correctly to earn your badges and points.', 'QUIZ', 30, NULL, 'Tunisian Explorer', '2026-04-26 11:19:04.000000', '2026-04-27 11:19:04.000000'),
(10, b'1', 'Test your knowledge of Tunisia\'s rich history by answering 5 questions about its ancient civilizations, colonial era, and path to independence. Achieve a perfect score to earn the reward.', 'QUIZ', 40, 12, 'Tunisian Timeline 8271', '2026-04-26 11:23:57.000000', '2026-04-27 11:23:57.000000');

-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- Table structure for table `games`
--

CREATE TABLE `games` (
  `id` bigint(20) NOT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `genre` varchar(50) DEFAULT NULL,
  `image_url` varchar(512) DEFAULT NULL,
  `platform` varchar(50) DEFAULT NULL,
  `release_year` int(11) DEFAULT NULL,
  `status` varchar(20) NOT NULL,
  `title` varchar(100) NOT NULL,
  `updated_at` datetime(6) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `game_unlock_costs`
--

CREATE TABLE `game_unlock_costs` (
  `game_id` varchar(255) NOT NULL,
  `cost_points` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `game_unlock_costs`
--

INSERT INTO `game_unlock_costs` (`game_id`, `cost_points`) VALUES
('EL_JEM_QUEST', 150);

-- --------------------------------------------------------

--
-- Table structure for table `karaoke_songs`
--

CREATE TABLE `karaoke_songs` (
  `id` bigint(20) NOT NULL,
  `artist` varchar(255) DEFAULT NULL,
  `audio_url` varchar(255) DEFAULT NULL,
  `lyrics_json` text DEFAULT NULL,
  `published` bit(1) NOT NULL,
  `title` varchar(255) DEFAULT NULL,
  `instrumental_url` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `karaoke_songs`
--

INSERT INTO `karaoke_songs` (`id`, `artist`, `audio_url`, `lyrics_json`, `published`, `title`, `instrumental_url`) VALUES
(4, 'samir lousif', '/uploads/audio/48edd96f-7860-433f-a6ab-9de36ad39eb0.mp3', '[{\"start\":0.0,\"end\":29.98,\"text\":\"اشتركوا في القناة\"},{\"start\":30.0,\"end\":34.0,\"text\":\"واش فرعسل واتيك وخيالي\"},{\"start\":34.52,\"end\":47.0,\"text\":\"موسيقى\"},{\"start\":47.0,\"end\":53.06,\"text\":\"بس هيا عينيك رباني بس هيا عينيك\"},{\"start\":53.06,\"end\":60.0,\"text\":\"بس هيا عينيك واشفرنا سلم واتيك وخياليك\"},{\"start\":77.0,\"end\":98.0,\"text\":\"موسيقى\"},{\"start\":98.0,\"end\":106.64,\"text\":\"تسحر عيني ربني تسحر عيني ربني تسحر عيني\"},{\"start\":106.64,\"end\":110.900406,\"text\":\"\"},{\"start\":138.9004,\"end\":142.9004,\"text\":\"سرّاسا لنواتيكو خياري\"},{\"start\":168.9004,\"end\":191.9004,\"text\":\"موسيقى\"},{\"start\":191.9004,\"end\":197.9004,\"text\":\"تسحر عيني ربني تسحر عيني رباني\"},{\"start\":197.9004,\"end\":204.30042,\"text\":\"تسحر عيني مشرع سلم واتيك وخياني\"},{\"start\":221.9004,\"end\":235.80081,\"text\":\"\"},{\"start\":252.80081,\"end\":281.8008,\"text\":\"موسيقى\"},{\"start\":282.8008,\"end\":289.8008,\"text\":\"تسهل عينيك ربني تسهل عينيك رباني\"},{\"start\":290.56082,\"end\":297.0008,\"text\":\"تسهل عينيك واشهر عسل لمواتيك وخيانيك\"},{\"start\":312.8008,\"end\":365.70123,\"text\":\"\"},{\"start\":366.70123,\"end\":396.68124,\"text\":\"Thank you.\"},{\"start\":396.70123,\"end\":426.68124,\"text\":\"Thank you.\"},{\"start\":426.70123,\"end\":455.50122,\"text\":\"Thank you.\"}]', b'1', 'tes7er 3inik', '/uploads/audio/61423785-b475-4202-bca2-3397d3036956.mp3'),
(5, 'hadhra', '/uploads/audio/6b251476-db27-44c7-984b-f14c1a120f94.mp3', '[{\"start\":0.0,\"end\":29.98,\"text\":\"Thank you.\"},{\"start\":30.0,\"end\":70.75836,\"text\":\"Thank you\"},{\"start\":71.27836,\"end\":75.13836,\"text\":\"الشيخ ربا بابا بابا\"},{\"start\":75.13836,\"end\":79.05836,\"text\":\"قول الأشياء\"},{\"start\":79.05836,\"end\":82.01836,\"text\":\"لا شيء تساير\"},{\"start\":88.75836,\"end\":118.73836,\"text\":\"ترجمة نانسي قنقر\"},{\"start\":118.75836,\"end\":133.95671,\"text\":\"\"},{\"start\":152.51672,\"end\":154.51672,\"text\":\"موسيقى\"},{\"start\":182.51672,\"end\":215.27507,\"text\":\"\"},{\"start\":216.27507,\"end\":227.93507,\"text\":\"No, nothing is going on, nothing is going on, nothing is going on for Sheikh Baba, Baba.\"},{\"start\":227.93507,\"end\":252.29507,\"text\":\"Outro Music\"}]', b'1', 'na jait zayer', '/uploads/audio/0632d2dd-c8e0-474e-bb30-4d0a869da6ea.mp3'),
(6, 'Hedi jouini ', '/uploads/audio/9be18180-8506-4759-87ef-2df4719e33ce.mp3', '[{\"start\":0.0,\"end\":2.0,\"text\":\"موسيقى\"},{\"start\":30.0,\"end\":56.0,\"text\":\"حبي يتبدل يتجدد ما يتعدش كيف يتعدد\"},{\"start\":56.0,\"end\":65.0,\"text\":\"فكر يقولك كيف ما سنتي لكن قلبي يحبك انتي\"},{\"start\":86.0,\"end\":102.79102,\"text\":\"\"},{\"start\":102.79102,\"end\":106.79102,\"text\":\"حبيتك طفلة و بنيّة\"},{\"start\":106.79102,\"end\":111.79102,\"text\":\"حبيتك كيف زرت صغية\"},{\"start\":111.79102,\"end\":115.79102,\"text\":\"حبيتك طفلة و بنيّة\"},{\"start\":115.79102,\"end\":119.79102,\"text\":\"حبيتك كيف زرت صغية\"},{\"start\":119.79102,\"end\":128.79102,\"text\":\"حبيتك كيف بنت العم بحررت روحي والدم\"},{\"start\":128.79102,\"end\":133.79102,\"text\":\"كيف ما يرجع الفرطة الطبق لمن عارف اللي نحبه\"},{\"start\":133.79102,\"end\":137.79102,\"text\":\"كيف ما يرجع الفلاح للحق للي عارفه\"},{\"start\":137.79102,\"end\":142.79102,\"text\":\"كيف ما يرجع الملاح للبحر اللي غاربه\"},{\"start\":142.79102,\"end\":147.79102,\"text\":\"نرجع لك حير ومهيني\"},{\"start\":147.79102,\"end\":150.79102,\"text\":\"انتي وقلبي اقوى مني\"},{\"start\":151.79102,\"end\":155.79102,\"text\":\"حبي يتبتل يتجادل\"},{\"start\":156.79102,\"end\":159.79102,\"text\":\"لا يتعبش كيف يتعدي\"},{\"start\":160.79102,\"end\":164.79102,\"text\":\"حبي يتبتل يتجادل\"},{\"start\":165.79102,\"end\":168.79102,\"text\":\"لا يتعبش كيف يتعدي\"},{\"start\":168.79102,\"end\":172.79102,\"text\":\"إليتنا كن dungeons of hell\"},{\"start\":172.79102,\"end\":175.71103,\"text\":\"of treball جگرانATE\"},{\"start\":179.89102,\"end\":182.89102,\"text\":\"ال Liyسane\"},{\"start\":193.57101,\"end\":213.58205,\"text\":\"J Max\"},{\"start\":216.58205,\"end\":233.58205,\"text\":\"حبيتك كف حجليا مرسو ما مشي منسيا\"},{\"start\":233.58205,\"end\":247.58205,\"text\":\"نحبك وانا حبك حياتي مش اخسرتك كيف ما يرجع الفرطة الطب من نار اللي ضحكو\"},{\"start\":247.58205,\"end\":256.58203,\"text\":\"كيف ما يرجع الفلاح من الحمل اللي عارقو كيف ما يرجع الملاح من البحر اللي مركو\"},{\"start\":256.58203,\"end\":261.38205,\"text\":\"نرجع لك حير ومهني\"},{\"start\":261.38205,\"end\":265.38205,\"text\":\"انتي وقلبي اقوى مني\"},{\"start\":265.38205,\"end\":270.38205,\"text\":\"حبي يتبادل يتجادل\"},{\"start\":270.38205,\"end\":274.38205,\"text\":\"ما يتعدش كيف يتعدل\"},{\"start\":274.38205,\"end\":279.38205,\"text\":\"حبي يتبادل يتجادل\"},{\"start\":279.38205,\"end\":291.27304,\"text\":\"curvature\"},{\"start\":312.37305,\"end\":328.37305,\"text\":\"موسيقى\"},{\"start\":328.37305,\"end\":346.37305,\"text\":\"أنا حبيت جملة ما فيك يعجبني حسنك غويك\"},{\"start\":346.37305,\"end\":355.37305,\"text\":\"ادوني منك يعجبني والسبة منك تضربني\"},{\"start\":355.37305,\"end\":359.37305,\"text\":\"كيفما يرجع الفرطة للنار اللي ضحكو\"},{\"start\":359.37305,\"end\":364.37305,\"text\":\"كيفما يرجع الفلاح للحن اللي عرقو\"},{\"start\":364.37305,\"end\":368.37305,\"text\":\"كيفما يرجع الملاح للبحر اللي غرقو\"},{\"start\":368.37305,\"end\":373.37305,\"text\":\"نرجع لك حير ومهني\"},{\"start\":373.37305,\"end\":377.37305,\"text\":\"انتو قلبي اقوى ميني\"}]', b'1', 'hobi yetbadel yetjaded', '/uploads/audio/abed45dc-1e1c-46cf-bad8-6ba5cea139f3.mp3'),
(7, 'Ya Lella wink', '/uploads/audio/ca1f7cec-2ae4-4663-8f26-b142d7e63520.mp3', '[{\"start\":0.0,\"end\":2.0,\"text\":\"موسيقى\"},{\"start\":30.0,\"end\":39.0,\"text\":\"يا للا وينك توحشت وزينك الشوق فناني والكاسة عبّا\"},{\"start\":39.0,\"end\":48.0,\"text\":\"لو كانت جيني وتشوفك عيني نحلف بيميني نبني لك قبّا\"},{\"start\":48.0,\"end\":57.0,\"text\":\"ونخبّج روحي ونفرش لك روحي ونسقي بساتينك ودياني محبّا\"},{\"start\":57.0,\"end\":66.0,\"text\":\"و نخب جروحي و نفرش لك روحي و نسقي ب ستينك و دياني محبة\"},{\"start\":66.0,\"end\":84.030205,\"text\":\"\"},{\"start\":84.030205,\"end\":93.030205,\"text\":\"لو كانت جيني وتشوفك عيني نحلف بيميني نبني لك قبّا\"},{\"start\":93.030205,\"end\":111.030205,\"text\":\"ونخبج روحي ونفرش لك روحي ونسقي بساتينك ودياني محبة\"},{\"start\":111.030205,\"end\":119.030205,\"text\":\"ارحم يا سيدي شو ارحم تنهيدي الشوق فناني والكاسة عمّا\"},{\"start\":141.03021,\"end\":163.06041,\"text\":\"\"},{\"start\":163.06041,\"end\":181.06041,\"text\":\"ملّت الطيبة وروحك لحبيبة تنعوش لي روحي وننساها الغربة\"},{\"start\":181.06041,\"end\":191.06041,\"text\":\"ارحم يا سيدي جرحي وتنهيدي الشوق فلاني والكاسي تعبّا\"},{\"start\":211.06041,\"end\":234.0906,\"text\":\"\"},{\"start\":250.0906,\"end\":260.0906,\"text\":\"ارحم يا سيدي جرحي وتنهيدي الشوق فناني والكاسة تعبّى\"},{\"start\":260.0906,\"end\":269.0906,\"text\":\"يا ليلة وينك توحشت وزينك الشوق فناني والكاسة تعبّى\"},{\"start\":269.0906,\"end\":278.0906,\"text\":\"لو كانت جيني وتشوفك عيني نحلف بيميني نبني للكبّة\"},{\"start\":278.0906,\"end\":287.0906,\"text\":\"ونخبي شروحي ونفرش لك روحي نسقي بسدينك ودياني محبة\"},{\"start\":287.0906,\"end\":297.0906,\"text\":\"ارحم يا سيدي جرحي وتنهيدي الشوق فناني والكاسة تعبة\"}]', b'1', 'Lotfi Bouchnak', '/uploads/audio/fbc1cf03-ce9c-4174-a4ff-608be0fcfc4d.mp3');

-- --------------------------------------------------------

--
-- Table structure for table `levels`
--

CREATE TABLE `levels` (
  `level_id` int(11) NOT NULL,
  `max_points` int(11) DEFAULT NULL,
  `min_points` int(11) DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `levels`
--

INSERT INTO `levels` (`level_id`, `max_points`, `min_points`, `name`) VALUES
(1, 100, 0, 'BRONZE'),
(2, 500, 101, 'SILVER'),
(3, 2147483647, 501, 'GOLD');

-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- Table structure for table `ludo_cards`
--

CREATE TABLE `ludo_cards` (
  `card_id` int(11) NOT NULL,
  `category` varchar(255) DEFAULT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `effect_steps` int(11) DEFAULT NULL,
  `published` bit(1) DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- Table structure for table `passport_achievement`
--

CREATE TABLE `passport_achievement` (
  `achievement_id` int(11) NOT NULL,
  `achievement_code` varchar(80) NOT NULL,
  `badge_tone` varchar(40) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `title` varchar(140) NOT NULL,
  `unlocked_at` datetime(6) DEFAULT NULL,
  `passport_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `passport_city_stamp`
--

CREATE TABLE `passport_city_stamp` (
  `stamp_id` int(11) NOT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `emblem_key` varchar(120) DEFAULT NULL,
  `first_visited_at` datetime(6) DEFAULT NULL,
  `last_visited_at` datetime(6) DEFAULT NULL,
  `memory_note` text DEFAULT NULL,
  `photo_url` text DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `visit_count` int(11) NOT NULL,
  `city_id` int(11) NOT NULL,
  `passport_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `passport_photo`
--

CREATE TABLE `passport_photo` (
  `photo_id` int(11) NOT NULL,
  `caption` text DEFAULT NULL,
  `photo_url` text NOT NULL,
  `uploaded_at` datetime(6) DEFAULT NULL,
  `city_id` int(11) DEFAULT NULL,
  `passport_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `point_packages`
--

CREATE TABLE `point_packages` (
  `id` bigint(20) NOT NULL,
  `active` bit(1) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `points_amount` int(11) NOT NULL,
  `price` double NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `point_packages`
--

INSERT INTO `point_packages` (`id`, `active`, `name`, `points_amount`, `price`) VALUES
(1, b'1', 'lite', 100, 20),
(2, b'1', 'elite', 1000, 500),
(3, b'1', 'pro', 500, 300);

-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- Table structure for table `puzzle_images`
--

CREATE TABLE `puzzle_images` (
  `puzzle_id` int(11) NOT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `image_data_url` longtext DEFAULT NULL,
  `published` bit(1) DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `puzzle_images`
--

INSERT INTO `puzzle_images` (`puzzle_id`, `created_at`, `image_data_url`, `published`, `title`) VALUES
(1, '2026-03-26 16:25:44.000000', '/api/ludification/puzzles/files/db2d7961-e302-41ce-973d-55edf6f57370.png', b'1', 'tunisia');

-- --------------------------------------------------------

--
-- Table structure for table `quizzes`
--

CREATE TABLE `quizzes` (
  `published` bit(1) DEFAULT NULL,
  `quiz_id` int(11) NOT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  `cover_image_url` varchar(2000) DEFAULT NULL,
  `time_limit_seconds` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `quizzes`
--

INSERT INTO `quizzes` (`published`, `quiz_id`, `created_at`, `description`, `title`, `cover_image_url`, `time_limit_seconds`) VALUES
(b'1', 1, '2026-03-25 14:37:21.000000', 'first game', 'tuto', NULL, NULL),
(b'0', 2, '2026-03-25 23:20:22.000000', 'aaaaa', 'ooo', NULL, NULL),
(b'0', 3, '2026-03-28 16:51:31.000000', 'aaa', 'aaa', NULL, NULL),
(b'0', 7, '2026-04-06 21:21:10.000000', 'azeazioejzaojzoijeoiaj', 'hedha', '/uploads/profile-images/c5edac21-2cd6-41df-b9bd-b97d1328d4d8.png', 60),
(b'1', 8, '2026-04-23 21:20:01.000000', 'Discover the wonders of Tunisia and test your knowledge about its history, culture, and landmarks', 'Tunisian Explorer', NULL, 120),
(b'1', 9, '2026-04-24 19:56:55.000000', 'Discover the hidden gems of Tunisia and test your knowledge of its rich history, culture, and natural beauty', 'Tunisian Treasure', NULL, 120),
(b'1', 10, '2026-04-26 11:00:37.000000', 'Embark on a journey to test your knowledge of Tunisia\'s rich history, culture, and breathtaking landscapes.', 'Tunisian Odyssey', NULL, 120),
(b'1', 11, '2026-04-26 11:20:37.000000', 'Test your knowledge about Tunisia', 'Tunisian Explorer Quiz', NULL, 120),
(b'1', 12, '2026-04-26 11:23:55.000000', 'Test your knowledge of Tunisian history from ancient times to the present day', 'Tunisian Timeline 8271#3482', NULL, 120);

-- --------------------------------------------------------

--
-- Table structure for table `quiz_questions`
--

CREATE TABLE `quiz_questions` (
  `correct_option_index` int(11) DEFAULT NULL,
  `order_index` int(11) DEFAULT NULL,
  `question_id` int(11) NOT NULL,
  `quiz_id` int(11) DEFAULT NULL,
  `image_url` varchar(255) DEFAULT NULL,
  `question_text` varchar(255) DEFAULT NULL,
  `options_json` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `quiz_questions`
--

INSERT INTO `quiz_questions` (`correct_option_index`, `order_index`, `question_id`, `quiz_id`, `image_url`, `question_text`, `options_json`) VALUES
(0, 1, 1, 1, NULL, 'quelle est la capitale ?', '[\"tunis\",\"beja\",\"kef\",\"sfax\"]'),
(0, 1, 3, 2, NULL, 'aaaaaaaaa', '[\"aaaaaaa\",\"aaaaaaa\",\"aaaaaa\",\"aaaaaaaaaaa\"]'),
(0, 1, 4, 3, NULL, 'aa', '[\"aa\",\"aa\",\"aa\",\"aa\"]'),
(2, 0, 9, 7, NULL, 'qu\'elle est cette ville', '[\"Gabes\",\"Tataouine\",\"sidi bou said\",\"ariana\"]'),
(0, 0, 10, 8, NULL, 'What is the name of the famous ancient city located near modern-day Tunis?', '[\"Carthage\",\"Leptis Magna\",\"Dougga\",\"Utica\"]'),
(2, 1, 11, 8, NULL, 'Which of the following Tunisian cities is known for its beautiful island and medieval fortress?', '[\"Sousse\",\"Monastir\",\"Djerba\",\"Sfax\"]'),
(0, 2, 12, 8, NULL, 'What is the name of the highest mountain peak in Tunisia?', '[\"Jebel ech Chambi\",\"Jebel Serj\",\"Jebel Zaghouan\",\"Jebel Mansour\"]'),
(0, 3, 13, 8, NULL, 'Which Tunisian dish is a popular staple made from semolina flour, meat, and spices?', '[\"Couscous\",\"Shakshuka\",\"Harissa\",\"Brik\"]'),
(0, 4, 14, 8, NULL, 'What is the name of the famous Tunisian festival that celebrates music, dance, and theater?', '[\"Carthage International Festival\",\"Tunis International Film Festival\",\"Djerba International Festival\",\"Tozeur International Festival\"]'),
(0, 0, 15, 9, NULL, 'What is the name of the ancient city and UNESCO World Heritage Site located near modern-day Tunis?', '[\"Carthage\",\"Dougga\",\"Leptis Magna\",\"Utica\"]'),
(0, 1, 16, 9, NULL, 'Which of the following Tunisian islands is known for its beautiful beaches and coral reefs?', '[\"Djerba\",\"Kerkennah\",\"Zarzis\",\"Sfax\"]'),
(2, 2, 17, 9, NULL, 'What is the name of the famous Tunisian dish made with eggs, meat, and spices, often served in a flaky pastry crust?', '[\"Shakshuka\",\"Msemen\",\"Brik\",\"Harissa\"]'),
(0, 3, 18, 9, NULL, 'Which Tunisian city is known as the \'Gateway to the Sahara\' and is a popular starting point for desert treks?', '[\"Tozeur\",\"Gafsa\",\"Kairouan\",\"Sfax\"]'),
(0, 4, 19, 9, NULL, 'What is the name of the Tunisian festival that celebrates the country\'s rich cultural heritage and features music, dance, and theater performances?', '[\"Carthage International Festival\",\"Tunis International Film Festival\",\"Dougga Festival\",\"Sousse Festival\"]'),
(0, 0, 20, 10, NULL, 'Which city is the capital of Tunisia?', '[\"Tunis\",\"Sousse\",\"Monastir\",\"Djerba\"]'),
(0, 1, 21, 10, NULL, 'What is the name of the famous ancient city located near modern-day Tunis?', '[\"Carthage\",\"Dougga\",\"Bulla Regia\",\"Leptis Magna\"]'),
(3, 2, 22, 10, NULL, 'Which of the following is a UNESCO World Heritage site in Tunisia?', '[\"Ichkeul National Park\",\"Douz\",\"Tozeur\",\"All of the above\"]'),
(0, 3, 23, 10, NULL, 'What is the name of the mountain range that stretches across northern Tunisia?', '[\"Dorsale\",\"Atlas Mountains\",\"Sahara Desert\",\"Tell Atlas\"]'),
(2, 4, 24, 10, NULL, 'Which island is known for its beautiful beaches and is a popular tourist destination in Tunisia?', '[\"Jerba\",\"Kerkennah\",\"Djerba\",\"Zarzis\"]'),
(0, 0, 25, 11, NULL, 'What is the capital of Tunisia?', '[\"Tunis\",\"Sousse\",\"Sfax\",\"Monastir\"]'),
(2, 1, 26, 11, NULL, 'Which of the following is a famous Tunisian dish?', '[\"Shawarma\",\"Harissa\",\"Couscous\",\"Falafel\"]'),
(0, 2, 27, 11, NULL, 'What is the name of the largest island in Tunisia?', '[\"Djerba\",\"Kerkennah\",\"Zarzis\",\"Sfax\"]'),
(1, 3, 28, 11, NULL, 'Who is the founder of Carthage?', '[\"Hannibal\",\"Dido\",\"Elissa\",\"Pyrrhus\"]'),
(0, 4, 29, 11, NULL, 'What is the name of the highest mountain peak in Tunisia?', '[\"Jebel ech Chambi\",\"Jebel Serj\",\"Jebel Zaghouan\",\"Jebel Mansour\"]'),
(1, 0, 30, 12, NULL, 'In what year did the Aghlabid dynasty establish their capital in Tunisia', '[\"800 AD\",\"827 AD\",\"900 AD\",\"1000 AD\"]'),
(3, 1, 31, 12, NULL, 'Which of the following ancient civilizations had a significant presence in Tunisia', '[\"Romans\",\"Greeks\",\"Carthaginians\",\"All of the above\"]'),
(1, 2, 32, 12, NULL, 'The Tunisian revolution that led to the ousting of President Zine El Abidine Ben Ali began in which year', '[\"2010\",\"2011\",\"2012\",\"2013\"]'),
(0, 3, 33, 12, NULL, 'The city of Carthage was founded by which Phoenician queen', '[\"Dido\",\"Cleopatra\",\"Hannibal\'s mother\",\"None of the above\"]'),
(2, 4, 34, 12, NULL, 'Tunisia gained its independence from France in which year', '[\"1954\",\"1955\",\"1956\",\"1957\"]');

-- --------------------------------------------------------

--
-- Table structure for table `recipes`
--

CREATE TABLE `recipes` (
  `id` bigint(20) NOT NULL,
  `bg_image_url` varchar(255) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `reward_points` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `final_dish_image_url` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `recipes`
--

INSERT INTO `recipes` (`id`, `bg_image_url`, `description`, `reward_points`, `title`, `final_dish_image_url`) VALUES
(1, 'assets/images/chef_bg.png', 'A light and fluffy Tunisian style cake.', 1000, 'Cloud Cake', NULL),
(3, 'assets/images/chef_bg.png', 'ejja scaloppe maghyr scaloppe', 1000, ' ejja', '/uploads/profile-images/ced840e9-694e-496e-9e30-d43b71428a97.jpeg'),
(4, 'assets/images/chef_bg.png', 'kafteji qarwi f ariana soghra ', 1000, ' kafteji ', '/uploads/profile-images/5e42e191-cf36-4570-8657-387c01b164f9.jpeg');

-- --------------------------------------------------------

--
-- Table structure for table `recipe_ingredients`
--

CREATE TABLE `recipe_ingredients` (
  `recipe_id` bigint(20) NOT NULL,
  `ingredient_id` bigint(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `recipe_ingredients`
--

INSERT INTO `recipe_ingredients` (`recipe_id`, `ingredient_id`) VALUES
(1, 1),
(1, 2),
(1, 3),
(1, 4),
(3, 6),
(3, 3),
(3, 7),
(4, 8),
(4, 9),
(4, 10),
(4, 3);

-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- Table structure for table `roadmap_nodes`
--

CREATE TABLE `roadmap_nodes` (
  `crossword_id` int(11) DEFAULT NULL,
  `node_id` int(11) NOT NULL,
  `quiz_id` int(11) DEFAULT NULL,
  `step_order` int(11) DEFAULT NULL,
  `node_label` varchar(255) DEFAULT NULL,
  `puzzle_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `roadmap_nodes`
--

INSERT INTO `roadmap_nodes` (`crossword_id`, `node_id`, `quiz_id`, `step_order`, `node_label`, `puzzle_id`) VALUES
(1, 4, NULL, 2, '2', NULL),
(NULL, 5, 2, 3, '5', NULL),
(NULL, 6, NULL, 4, '256', 1),
(NULL, 7, 3, 5, '6', NULL),
(NULL, 9, 7, 5, '7', NULL);

-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- Table structure for table `tournaments`
--

CREATE TABLE `tournaments` (
  `tournament_id` int(11) NOT NULL,
  `description` varchar(3000) DEFAULT NULL,
  `ends_at` datetime(6) DEFAULT NULL,
  `starts_at` datetime(6) DEFAULT NULL,
  `status` enum('DRAFT','FINISHED','LIVE') DEFAULT NULL,
  `title` varchar(300) NOT NULL,
  `winner_badge_id` int(11) DEFAULT NULL,
  `winner_user_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tournament_participations`
--

CREATE TABLE `tournament_participations` (
  `id` int(11) NOT NULL,
  `total_score` int(11) NOT NULL,
  `tournament_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tournament_rounds`
--

CREATE TABLE `tournament_rounds` (
  `round_id` int(11) NOT NULL,
  `game_id` int(11) DEFAULT NULL,
  `game_kind` enum('CROSSWORD','KARAOKE','LUDO','PUZZLE','QUIZ','ROADMAP_NODE') NOT NULL,
  `round_ends_at` datetime(6) DEFAULT NULL,
  `round_starts_at` datetime(6) DEFAULT NULL,
  `sequence_order` int(11) NOT NULL,
  `tournament_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- Table structure for table `user_badges`
--

CREATE TABLE `user_badges` (
  `user_badge_id` int(11) NOT NULL,
  `earned_at` datetime(6) DEFAULT NULL,
  `badge_id` int(11) NOT NULL,
  `tournament_id` int(11) DEFAULT NULL,
  `user_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `user_badges`
--

INSERT INTO `user_badges` (`user_badge_id`, `earned_at`, `badge_id`, `tournament_id`, `user_id`) VALUES
(1, '2026-04-26 10:51:41.000000', 6, NULL, 7),
(2, '2026-04-26 10:54:50.000000', 6, NULL, 6);

-- --------------------------------------------------------

--
-- Table structure for table `user_daily_challenge_completions`
--

CREATE TABLE `user_daily_challenge_completions` (
  `id` int(11) NOT NULL,
  `completed_at` datetime(6) DEFAULT NULL,
  `points_earned` int(11) DEFAULT NULL,
  `challenge_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `user_daily_challenge_completions`
--

INSERT INTO `user_daily_challenge_completions` (`id`, `completed_at`, `points_earned`, `challenge_id`, `user_id`) VALUES
(1, '2026-04-06 22:15:25.000000', 10, 1, 6),
(2, '2026-04-23 21:21:20.000000', 30, 2, 7),
(3, '2026-04-23 21:21:20.000000', 30, 3, 7);

-- --------------------------------------------------------

--
-- Table structure for table `user_digital_passport`
--

CREATE TABLE `user_digital_passport` (
  `passport_id` int(11) NOT NULL,
  `bio_note` text DEFAULT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `join_date` datetime(6) DEFAULT NULL,
  `passport_number` varchar(32) NOT NULL,
  `travel_style_badge` varchar(120) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `user_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- Table structure for table `user_roadmap_completions`
--

CREATE TABLE `user_roadmap_completions` (
  `completion_id` int(11) NOT NULL,
  `max_score` int(11) DEFAULT NULL,
  `node_id` int(11) DEFAULT NULL,
  `score` int(11) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `completed_at` datetime(6) DEFAULT NULL,
  `username` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `user_roadmap_completions`
--

INSERT INTO `user_roadmap_completions` (`completion_id`, `max_score`, `node_id`, `score`, `user_id`, `completed_at`, `username`) VALUES
(2, 23, 4, 23, NULL, '2026-03-28 16:53:56.000000', 'user'),
(3, 1, 5, 1, NULL, '2026-03-28 16:54:03.000000', 'user'),
(4, 1, 6, 1, NULL, '2026-03-28 17:03:35.000000', 'user'),
(5, 1, 7, 1, NULL, '2026-03-28 18:16:06.000000', 'user'),
(7, 23, 4, 23, 7, '2026-04-06 21:22:09.000000', 'aziz'),
(8, 1, 5, 1, 7, '2026-04-06 21:22:22.000000', 'aziz'),
(9, 1, 6, 1, 7, '2026-04-06 21:23:10.000000', 'aziz'),
(10, 1, 7, 1, 7, '2026-04-06 21:23:17.000000', 'aziz'),
(11, 1, 9, 1, 7, '2026-04-06 21:23:25.000000', 'aziz'),
(12, 23, 4, 23, 6, '2026-04-07 00:20:49.000000', 'elyes'),
(13, 1, 5, 1, 6, '2026-04-07 00:20:57.000000', 'elyes'),
(14, 1, 6, 1, 6, '2026-04-11 13:42:35.000000', 'elyes'),
(15, 1, 7, 1, 6, '2026-04-11 13:42:39.000000', 'elyes'),
(16, 1, 9, 0, 6, '2026-04-11 13:42:46.000000', 'elyes');

-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- Table structure for table `user_unlocked_games`
--

CREATE TABLE `user_unlocked_games` (
  `id` bigint(20) NOT NULL,
  `game_id` varchar(255) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `user_unlocked_games`
--

INSERT INTO `user_unlocked_games` (`id`, `game_id`, `user_id`) VALUES
(1, 'EL_JEM_QUEST', 6);

-- --------------------------------------------------------

--
-- --------------------------------------------------------

--
-- Indexes for table `badges`
--
ALTER TABLE `badges`
  ADD PRIMARY KEY (`badge_id`);

--
-- Indexes for table `cooking_ingredients`
--
ALTER TABLE `cooking_ingredients`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `crosswords`
--
ALTER TABLE `crosswords`
  ADD PRIMARY KEY (`crossword_id`);

--
-- Indexes for table `daily_challenges`
--
ALTER TABLE `daily_challenges`
  ADD PRIMARY KEY (`challenge_id`);

--
-- Indexes for table `games`
--
ALTER TABLE `games`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `game_unlock_costs`
--
ALTER TABLE `game_unlock_costs`
  ADD PRIMARY KEY (`game_id`);

--
-- Indexes for table `karaoke_songs`
--
ALTER TABLE `karaoke_songs`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `levels`
--
ALTER TABLE `levels`
  ADD PRIMARY KEY (`level_id`);

--
-- Indexes for table `ludo_cards`
--
ALTER TABLE `ludo_cards`
  ADD PRIMARY KEY (`card_id`);

--
-- Indexes for table `passport_achievement`
--
ALTER TABLE `passport_achievement`
  ADD PRIMARY KEY (`achievement_id`),
  ADD UNIQUE KEY `uk_passport_achievement_code` (`passport_id`,`achievement_code`);

--
-- Indexes for table `passport_city_stamp`
--
ALTER TABLE `passport_city_stamp`
  ADD PRIMARY KEY (`stamp_id`),
  ADD UNIQUE KEY `uk_passport_city` (`passport_id`,`city_id`),
  ADD KEY `FK5rnb04u37hdegm3tm0m35dllg` (`city_id`);

--
-- Indexes for table `passport_photo`
--
ALTER TABLE `passport_photo`
  ADD PRIMARY KEY (`photo_id`),
  ADD KEY `FKkcc2do7er0x3w440qd4p40hk3` (`city_id`),
  ADD KEY `FKcdg07v3owmk88bkqewe4nakkj` (`passport_id`);

--
-- Indexes for table `point_packages`
--
ALTER TABLE `point_packages`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `puzzle_images`
--
ALTER TABLE `puzzle_images`
  ADD PRIMARY KEY (`puzzle_id`);

--
-- Indexes for table `quizzes`
--
ALTER TABLE `quizzes`
  ADD PRIMARY KEY (`quiz_id`);

--
-- Indexes for table `quiz_questions`
--
ALTER TABLE `quiz_questions`
  ADD PRIMARY KEY (`question_id`),
  ADD KEY `FKanfmgf6ksbdnv7ojb0pfve54q` (`quiz_id`);

--
-- Indexes for table `recipes`
--
ALTER TABLE `recipes`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `recipe_ingredients`
--
ALTER TABLE `recipe_ingredients`
  ADD KEY `FK2tx3pnk25jmqmw2obcxrn1kfp` (`ingredient_id`),
  ADD KEY `FKcqlw8sor5ut10xsuj3jnttkc` (`recipe_id`);

--
-- Indexes for table `roadmap_nodes`
--
ALTER TABLE `roadmap_nodes`
  ADD PRIMARY KEY (`node_id`),
  ADD KEY `FK6xpdcqynw9twuw85rqph9aily` (`crossword_id`),
  ADD KEY `FKfw108wqj66pvqyu90hps2f3jk` (`quiz_id`);

--
-- Indexes for table `tournaments`
--
ALTER TABLE `tournaments`
  ADD PRIMARY KEY (`tournament_id`),
  ADD KEY `FKqkhl9knbcqrbxh4ni8dtq70x3` (`winner_badge_id`),
  ADD KEY `FK92ywxkv7s8vj3f000d5i7cxh4` (`winner_user_id`);

--
-- Indexes for table `tournament_participations`
--
ALTER TABLE `tournament_participations`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `UKh3v038jla1abngnrvhbanoub9` (`tournament_id`,`user_id`),
  ADD KEY `FKshyw4nhqpxthsqexcp993ptep` (`user_id`);

--
-- Indexes for table `tournament_rounds`
--
ALTER TABLE `tournament_rounds`
  ADD PRIMARY KEY (`round_id`),
  ADD KEY `FKogdi0xmnrcooq9e1rnge3mxfc` (`tournament_id`);

--
-- Indexes for table `user_badges`
--
ALTER TABLE `user_badges`
  ADD PRIMARY KEY (`user_badge_id`),
  ADD KEY `FKk6e00pguaij0uke6xr81gt045` (`badge_id`),
  ADD KEY `FK8o7b2fni4c4p2v6i229mht02g` (`tournament_id`),
  ADD KEY `FKr46ah81sjymsn035m4ojstn5s` (`user_id`);

--
-- Indexes for table `user_daily_challenge_completions`
--
ALTER TABLE `user_daily_challenge_completions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `UKcmqlpj09dp8u9kww0tylug582` (`user_id`,`challenge_id`),
  ADD KEY `FK84ycy5e6nskt4pwdusie4k6rf` (`challenge_id`);

--
-- Indexes for table `user_digital_passport`
--
ALTER TABLE `user_digital_passport`
  ADD PRIMARY KEY (`passport_id`),
  ADD UNIQUE KEY `UKaa0h8oxdsihvqgt9ypwkwdyqr` (`passport_number`),
  ADD UNIQUE KEY `UKo8de0gpknypw907yex9uc15ww` (`user_id`);

--
-- Indexes for table `user_roadmap_completions`
--
ALTER TABLE `user_roadmap_completions`
  ADD PRIMARY KEY (`completion_id`),
  ADD UNIQUE KEY `UKsqa0t2l0021k4o52arv3cdthn` (`username`,`node_id`),
  ADD KEY `FK60lspxruco8ib44ac3gab2g44` (`node_id`),
  ADD KEY `FKqh8q48e3sdgkc6ypyjs6q07vf` (`user_id`);

--
-- Indexes for table `user_unlocked_games`
--
ALTER TABLE `user_unlocked_games`
  ADD PRIMARY KEY (`id`),
  ADD KEY `FKe7ehi1r23o2nl82ae510i1731` (`user_id`);

--
ALTER TABLE `badges`
  MODIFY `badge_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `bans`
--
ALTER TABLE `cooking_ingredients`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `crosswords`
--
ALTER TABLE `crosswords`
  MODIFY `crossword_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `daily_challenges`
--
ALTER TABLE `daily_challenges`
  MODIFY `challenge_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `distances`
--
ALTER TABLE `games`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `karaoke_songs`
--
ALTER TABLE `karaoke_songs`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `levels`
--
ALTER TABLE `levels`
  MODIFY `level_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `likes`
--
ALTER TABLE `ludo_cards`
  MODIFY `card_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `messages`
--
ALTER TABLE `passport_achievement`
  MODIFY `achievement_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `passport_city_stamp`
--
ALTER TABLE `passport_city_stamp`
  MODIFY `stamp_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `passport_photo`
--
ALTER TABLE `passport_photo`
  MODIFY `photo_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `point_packages`
--
ALTER TABLE `point_packages`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `posts`
--
ALTER TABLE `puzzle_images`
  MODIFY `puzzle_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `quizzes`
--
ALTER TABLE `quizzes`
  MODIFY `quiz_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT for table `quiz_questions`
--
ALTER TABLE `quiz_questions`
  MODIFY `question_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=35;

--
-- AUTO_INCREMENT for table `recipes`
--
ALTER TABLE `recipes`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `reservations`
--
ALTER TABLE `roadmap_nodes`
  MODIFY `node_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `roles`
--
ALTER TABLE `tournaments`
  MODIFY `tournament_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `tournament_participations`
--
ALTER TABLE `tournament_participations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `tournament_rounds`
--
ALTER TABLE `tournament_rounds`
  MODIFY `round_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `translations`
--
ALTER TABLE `user_badges`
  MODIFY `user_badge_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `user_daily_challenge_completions`
--
ALTER TABLE `user_daily_challenge_completions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `user_digital_passport`
--
ALTER TABLE `user_digital_passport`
  MODIFY `passport_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `user_preferences`
--
ALTER TABLE `user_roadmap_completions`
  MODIFY `completion_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT for table `user_unlocked_games`
--
ALTER TABLE `user_unlocked_games`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `vehicles`
--
-- Constraints for table `passport_achievement`
--
ALTER TABLE `passport_achievement`
  ADD CONSTRAINT `FK5l4poeldx9bt5febgc153ham3` FOREIGN KEY (`passport_id`) REFERENCES `user_digital_passport` (`passport_id`);

--
-- Constraints for table `passport_city_stamp`
--
ALTER TABLE `passport_city_stamp`
  ADD CONSTRAINT `FK5rnb04u37hdegm3tm0m35dllg` FOREIGN KEY (`city_id`) REFERENCES `cities` (`city_id`),
  ADD CONSTRAINT `FK61bky27rwshobdah2487cykad` FOREIGN KEY (`passport_id`) REFERENCES `user_digital_passport` (`passport_id`);

--
-- Constraints for table `passport_photo`
--
ALTER TABLE `passport_photo`
  ADD CONSTRAINT `FKcdg07v3owmk88bkqewe4nakkj` FOREIGN KEY (`passport_id`) REFERENCES `user_digital_passport` (`passport_id`),
  ADD CONSTRAINT `FKkcc2do7er0x3w440qd4p40hk3` FOREIGN KEY (`city_id`) REFERENCES `cities` (`city_id`);

--
-- Constraints for table `quiz_questions`
--
ALTER TABLE `quiz_questions`
  ADD CONSTRAINT `FKanfmgf6ksbdnv7ojb0pfve54q` FOREIGN KEY (`quiz_id`) REFERENCES `quizzes` (`quiz_id`);

--
-- Constraints for table `recipe_ingredients`
--
ALTER TABLE `recipe_ingredients`
  ADD CONSTRAINT `FK2tx3pnk25jmqmw2obcxrn1kfp` FOREIGN KEY (`ingredient_id`) REFERENCES `cooking_ingredients` (`id`),
  ADD CONSTRAINT `FKcqlw8sor5ut10xsuj3jnttkc` FOREIGN KEY (`recipe_id`) REFERENCES `recipes` (`id`);

--
-- Constraints for table `roadmap_nodes`
--
ALTER TABLE `roadmap_nodes`
  ADD CONSTRAINT `FK6xpdcqynw9twuw85rqph9aily` FOREIGN KEY (`crossword_id`) REFERENCES `crosswords` (`crossword_id`),
  ADD CONSTRAINT `FKfw108wqj66pvqyu90hps2f3jk` FOREIGN KEY (`quiz_id`) REFERENCES `quizzes` (`quiz_id`);

--
-- Constraints for table `tournaments`
--
ALTER TABLE `tournaments`
  ADD CONSTRAINT `FK92ywxkv7s8vj3f000d5i7cxh4` FOREIGN KEY (`winner_user_id`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `FKqkhl9knbcqrbxh4ni8dtq70x3` FOREIGN KEY (`winner_badge_id`) REFERENCES `badges` (`badge_id`);

--
-- Constraints for table `tournament_participations`
--
ALTER TABLE `tournament_participations`
  ADD CONSTRAINT `FK77s1scgxpwopuoswabpo1rhm` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments` (`tournament_id`),
  ADD CONSTRAINT `FKshyw4nhqpxthsqexcp993ptep` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `tournament_rounds`
--
ALTER TABLE `tournament_rounds`
  ADD CONSTRAINT `FKogdi0xmnrcooq9e1rnge3mxfc` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments` (`tournament_id`);

--
-- Constraints for table `user_badges`
--
ALTER TABLE `user_badges`
  ADD CONSTRAINT `FK8o7b2fni4c4p2v6i229mht02g` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments` (`tournament_id`),
  ADD CONSTRAINT `FKk6e00pguaij0uke6xr81gt045` FOREIGN KEY (`badge_id`) REFERENCES `badges` (`badge_id`),
  ADD CONSTRAINT `FKr46ah81sjymsn035m4ojstn5s` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `user_daily_challenge_completions`
--
ALTER TABLE `user_daily_challenge_completions`
  ADD CONSTRAINT `FK84ycy5e6nskt4pwdusie4k6rf` FOREIGN KEY (`challenge_id`) REFERENCES `daily_challenges` (`challenge_id`),
  ADD CONSTRAINT `FK9uplaevd5irmk7bdjps1xdord` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `user_digital_passport`
--
ALTER TABLE `user_digital_passport`
  ADD CONSTRAINT `FKrw724c3hyufidr96nhy6rouf9` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `user_roadmap_completions`
--
ALTER TABLE `user_roadmap_completions`
  ADD CONSTRAINT `FK60lspxruco8ib44ac3gab2g44` FOREIGN KEY (`node_id`) REFERENCES `roadmap_nodes` (`node_id`),
  ADD CONSTRAINT `FKqh8q48e3sdgkc6ypyjs6q07vf` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `user_unlocked_games`
--
ALTER TABLE `user_unlocked_games`
  ADD CONSTRAINT `FKe7ehi1r23o2nl82ae510i1731` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`);

--
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

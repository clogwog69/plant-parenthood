import type { Category, Guide, Season } from './types';
import { MORE_GUIDES } from './guides-more';

const warm: Season[] = ['summer', 'autumn'];

const pinch =
  'Pinch the flower heads off just above a pair of leaves. Once it flowers the leaves turn bitter and the plant stops growing, so removing them keeps it leafy.';
const bolt =
  'It is bolting (going to seed), usually from heat. The leaves turn bitter quickly, so harvest what you can now and sow a fresh batch somewhere cooler.';
const fruitSet =
  'Flowers mean fruit is on the way. Keep watering evenly and feed with a tomato or fruit fertiliser (high in potassium) every two weeks.';

const BASE: Guide[] = [
  // ───────── Herbs
  {
    key: 'basil', name: 'Basil', latin: 'Ocimum basilicum', category: 'herb',
    waterDays: 2, water: 'Keep the soil evenly moist. Water at the base in the morning.',
    light: 'Full sun, 6+ hours. A bright windowsill indoors.',
    repotMonths: 6, frostTender: true,
    harvest: { kind: 'continuous', seasons: ['spring', 'summer', 'autumn'], how: 'Pick the top pairs of leaves, cutting just above a leaf node. This makes it branch and grow bushier.' },
    tips: ['Never take more than a third of the plant at once.', 'It hates cold: bring pots inside below 10°C.'],
    signs: { flowering: pinch, leggy: 'Cut each stem back to just above the second pair of leaves. It will branch into two from every cut.' },
  },
  {
    key: 'mint', name: 'Mint', latin: 'Mentha', category: 'herb',
    waterDays: 2, water: 'Likes it damp. Never let the pot dry out completely.',
    light: 'Part shade to sun.',
    repotMonths: 12,
    harvest: { kind: 'continuous', how: 'Cut stems down to just above a pair of leaves. It grows back fast.' },
    tips: ['Always grow it in a pot, it takes over garden beds.', 'Cut it right back after flowering for fresh growth.'],
    signs: { flowering: 'Shear the whole plant back by half. You will get a flush of tender new leaves in a couple of weeks.', roots_out: 'Mint fills a pot fast. Tip it out, split the root ball in half and replant one half in fresh mix.' },
  },
  {
    key: 'parsley', name: 'Parsley', latin: 'Petroselinum crispum', category: 'herb',
    waterDays: 3, water: 'Keep moist but not soggy.',
    light: 'Sun to part shade.',
    repotMonths: 12,
    harvest: { kind: 'continuous', how: 'Snip the outer stems at the base and leave the centre to keep growing.' },
    tips: ['It lives two years, then flowers and finishes.', 'Feed with liquid fertiliser monthly.'],
    signs: { flowering: 'Parsley flowers in its second year and then dies. Cut the flower stalk to buy a few weeks, and sow new seed now.' },
  },
  {
    key: 'coriander', name: 'Coriander', aka: ['Cilantro'], latin: 'Coriandrum sativum', category: 'herb',
    waterDays: 2, water: 'Keep consistently moist. Drying out makes it bolt.',
    light: 'Morning sun, afternoon shade in warm weather.',
    repotMonths: 6,
    harvest: { kind: 'continuous', how: 'Cut outer stems near the base once the plant is 15 cm tall.' },
    tips: ['It bolts in heat. Grow it in the cooler months.', 'Sow a new batch every few weeks for a steady supply.'],
    signs: { flowering: bolt + ' You can also let it go and collect the seeds as coriander spice.' },
  },
  {
    key: 'rosemary', name: 'Rosemary', latin: 'Salvia rosmarinus', category: 'herb',
    waterDays: 8, water: 'Let the soil dry out between waterings. It rots in wet soil.',
    light: 'Full sun.',
    repotMonths: 24,
    harvest: { kind: 'continuous', how: 'Snip soft green tips. Avoid cutting into old bare wood, it does not regrow.' },
    tips: ['Needs sharp drainage. Add sand or grit to the mix.', 'Trim lightly after flowering to keep it compact.'],
    signs: { flowering: 'Lovely, and the bees agree. The flowers are edible. Give it a light trim once they finish.', yellow: 'Almost always too much water. Let it dry right out and check the pot drains freely.' },
  },
  {
    key: 'thyme', name: 'Thyme', latin: 'Thymus vulgaris', category: 'herb',
    waterDays: 8, water: 'Water sparingly, only when the soil is dry.',
    light: 'Full sun.',
    repotMonths: 24,
    harvest: { kind: 'continuous', how: 'Snip sprigs from the soft top growth.' },
    tips: ['Trim after flowering to stop it going woody.'],
    signs: { flowering: 'Fine to leave for the bees. Shear it lightly afterwards so it stays dense.' },
  },
  {
    key: 'chives', name: 'Chives', latin: 'Allium schoenoprasum', category: 'herb',
    waterDays: 3, water: 'Keep moist during the growing season.',
    light: 'Sun to part shade.',
    repotMonths: 18,
    harvest: { kind: 'continuous', how: 'Cut leaves 3 cm above the soil with scissors. They regrow within weeks.' },
    tips: ['Divide the clump every couple of years.'],
    signs: { flowering: 'The purple flowers are edible and good in salads. Cut the stalks at the base once they fade.' },
  },
  {
    key: 'oregano', name: 'Oregano', latin: 'Origanum vulgare', category: 'herb',
    waterDays: 6, water: 'Let the top of the soil dry between waterings.',
    light: 'Full sun.',
    repotMonths: 18,
    harvest: { kind: 'continuous', how: 'Cut stems back by a third. Flavour is strongest just before flowering.' },
    tips: ['Cut back hard in late winter for fresh growth.'],
    signs: { flowering: 'Cut the stems back by half. Flavour is at its peak right now, so dry what you cut.' },
  },
  {
    key: 'sage', name: 'Sage', latin: 'Salvia officinalis', category: 'herb',
    waterDays: 7, water: 'Water when the top few centimetres are dry.',
    light: 'Full sun.',
    repotMonths: 24,
    harvest: { kind: 'continuous', how: 'Pick individual leaves or soft tips.' },
    tips: ['Prune by a third in spring to stop it getting woody.'],
  },
  {
    key: 'dill', name: 'Dill', latin: 'Anethum graveolens', category: 'herb',
    waterDays: 3, water: 'Keep evenly moist.',
    light: 'Full sun, sheltered from wind.',
    repotMonths: 6,
    harvest: { kind: 'continuous', how: 'Snip feathery leaves as needed from the outside.' },
    tips: ['It does not like being transplanted. Sow it where it will stay.'],
    signs: { flowering: bolt + ' The flower heads and seeds are great for pickling.' },
  },
  {
    key: 'lemongrass', name: 'Lemongrass', latin: 'Cymbopogon citratus', category: 'herb',
    waterDays: 3, water: 'Thirsty in warm weather. Keep moist.',
    light: 'Full sun.',
    repotMonths: 12, frostTender: true,
    harvest: { kind: 'continuous', seasons: ['spring', 'summer', 'autumn'], how: 'Twist and pull whole stalks from the outside of the clump at the base.' },
    tips: ['Cut the whole clump back to 15 cm at the end of winter.'],
  },

  // ───────── Vegetables
  {
    key: 'tomato', name: 'Tomato', aka: ['Cherry tomato', 'Tomatoes'], latin: 'Solanum lycopersicum', category: 'vegetable',
    waterDays: 2, water: 'Deep, even watering at the base. Irregular watering splits the fruit.',
    light: 'Full sun, 6 to 8 hours.',
    repotMonths: 6, frostTender: true,
    harvest: { kind: 'seasonal', seasons: warm, how: 'Pick when fully coloured and slightly soft. They also ripen on a windowsill if picked at first blush.' },
    tips: ['Pinch out the side shoots between the stem and branches on tall varieties.', 'Stake early and tie in as it grows.', 'Mulch to keep the soil evenly moist.'],
    signs: {
      flowering: fruitSet + ' Give the stems a gentle shake to help pollination.',
      yellow: 'Lower leaves yellowing is normal as fruit sets. Snip them off for airflow. If it is moving up the plant, feed it.',
      spots: 'Likely early blight. Remove spotted leaves, never water the foliage, and mulch so soil does not splash up.',
      top_heavy: 'Tomatoes need at least a 30 litre pot. Move it up a size, bury the stem deeper, and add a sturdy stake.',
    },
  },
  {
    key: 'chilli', name: 'Chilli', latin: 'Capsicum annuum', category: 'vegetable',
    waterDays: 3, water: 'Water when the top 2 cm is dry. A little dry stress makes hotter chillies.',
    light: 'Full sun and warmth.',
    repotMonths: 12, frostTender: true,
    harvest: { kind: 'seasonal', seasons: warm, how: 'Cut fruit off with scissors when firm and glossy. Leave longer for red and sweeter or hotter.' },
    tips: ['Picking regularly keeps it producing.', 'Can live several years if kept frost free.'],
    signs: { flowering: fruitSet },
  },
  {
    key: 'lettuce', name: 'Lettuce', aka: ['Salad greens'], latin: 'Lactuca sativa', category: 'vegetable',
    waterDays: 2, water: 'Shallow roots. Keep the soil moist every day in warm weather.',
    light: 'Sun in cool weather, part shade in summer.',
    repotMonths: 6,
    harvest: { kind: 'continuous', how: 'Pick outer leaves and let the centre keep growing.' },
    tips: ['Sow a few more every fortnight.'],
    signs: { flowering: bolt, leggy: 'A stretching centre stalk means it is about to bolt. Harvest the whole plant now.' },
  },
  {
    key: 'spinach', name: 'Spinach', latin: 'Spinacia oleracea', category: 'vegetable',
    waterDays: 2, water: 'Keep moist. Dry spells make it bolt.',
    light: 'Sun to part shade.',
    repotMonths: 6,
    harvest: { kind: 'continuous', how: 'Twist off outer leaves at the base, leaving 4 or 5 in the centre.' },
    tips: ['Feed with a nitrogen-rich liquid fertiliser every two weeks.'],
    signs: { flowering: bolt },
  },
  {
    key: 'kale', name: 'Kale', latin: 'Brassica oleracea', category: 'vegetable',
    waterDays: 3, water: 'Regular deep watering.',
    light: 'Full sun to part shade.',
    repotMonths: 6,
    harvest: { kind: 'continuous', how: 'Pick the lowest leaves first, working up the stem.' },
    tips: ['Check under leaves for green caterpillars.'],
    signs: { pests: 'Almost certainly cabbage white caterpillars. Pick them off by hand and cover the plant with fine netting to stop the butterflies.' },
  },
  {
    key: 'cucumber', name: 'Cucumber', latin: 'Cucumis sativus', category: 'vegetable',
    waterDays: 2, water: 'Very thirsty. Water deeply at the base, never the leaves.',
    light: 'Full sun.',
    repotMonths: 6, frostTender: true,
    harvest: { kind: 'seasonal', seasons: ['summer', 'autumn'], how: 'Cut when firm and evenly green. Do not let them yellow on the vine or the plant stops producing.' },
    tips: ['Train it up a trellis for straighter fruit and fewer diseases.'],
    signs: { flowering: fruitSet + ' The first flowers are male and drop off. That is normal.', spots: 'White powder is powdery mildew. Remove the worst leaves and spray the rest with one part milk to nine parts water.' },
  },
  {
    key: 'zucchini', name: 'Zucchini', aka: ['Courgette'], latin: 'Cucurbita pepo', category: 'vegetable',
    waterDays: 2, water: 'Deep watering at the base in the morning.',
    light: 'Full sun.',
    repotMonths: 6, frostTender: true,
    harvest: { kind: 'seasonal', seasons: ['summer', 'autumn'], how: 'Cut at 15 to 20 cm long. Check daily, they double in size overnight.' },
    tips: ['Needs a lot of room, or a very large pot.'],
    signs: { flowering: 'If fruit is not setting, pick a male flower (thin stem) and dab its pollen inside a female flower (tiny fruit behind it).', spots: 'White powder is powdery mildew. Remove the worst leaves and spray the rest with one part milk to nine parts water.' },
  },
  {
    key: 'carrot', name: 'Carrot', latin: 'Daucus carota', category: 'vegetable',
    waterDays: 3, water: 'Even moisture. Drying out then soaking makes roots split.',
    light: 'Full sun.',
    repotMonths: 6,
    harvest: { kind: 'seasonal', seasons: ['spring', 'summer', 'autumn', 'winter'], how: 'Brush soil from the top of a root. If the shoulder is 2 cm across, pull it.' },
    tips: ['Thin seedlings to 5 cm apart so roots have room.'],
  },
  {
    key: 'beans', name: 'Beans', aka: ['Green beans'], latin: 'Phaseolus vulgaris', category: 'vegetable',
    waterDays: 3, water: 'Water well once flowering starts.',
    light: 'Full sun.',
    repotMonths: 6,
    harvest: { kind: 'seasonal', seasons: ['spring', 'summer', 'autumn'], how: 'Pick pods young and often. The more you pick, the more it makes.' },
    tips: ['Give climbers something to climb from day one.'],
    signs: { flowering: 'Pods are coming. Water consistently now, as dry spells make flowers drop.' },
  },
  {
    key: 'spring-onion', name: 'Spring onion', aka: ['Scallion', 'Shallot'], latin: 'Allium fistulosum', category: 'vegetable',
    waterDays: 3, water: 'Keep moist.',
    light: 'Full sun.',
    repotMonths: 6,
    harvest: { kind: 'continuous', how: 'Cut 3 cm above the soil and it will regrow, or pull the whole plant.' },
    tips: ['Regrow shop-bought ones by planting the white root ends.'],
  },
  {
    key: 'potato', name: 'Potato', latin: 'Solanum tuberosum', category: 'vegetable',
    waterDays: 4, water: 'Deep watering, especially once it flowers.',
    light: 'Full sun.',
    repotMonths: 6, frostTender: true,
    harvest: { kind: 'seasonal', seasons: ['summer', 'autumn'], how: 'Dig them up a couple of weeks after the tops yellow and die back.' },
    tips: ['Mound soil up around the stems as they grow.'],
    signs: { flowering: 'Flowers mean small new potatoes are ready underneath. Feel around gently for a few, or wait for the tops to die back for full size.', yellow: 'If it has already flowered, yellowing tops mean the crop is nearly ready. Stop watering and dig in two weeks.' },
  },
  {
    key: 'strawberry', name: 'Strawberry', latin: 'Fragaria × ananassa', category: 'fruit',
    waterDays: 2, water: 'Keep moist, water at the soil not over the fruit.',
    light: 'Full sun.',
    repotMonths: 12,
    harvest: { kind: 'seasonal', seasons: ['spring', 'summer'], how: 'Pick when red all the way to the stem. They do not ripen after picking.' },
    tips: ['Mulch with straw to keep fruit off the soil.', 'Snip off runners unless you want new plants.'],
    signs: { flowering: fruitSet + ' Net the plant now if birds visit.' },
  },

  // ───────── Fruit
  {
    key: 'lemon', name: 'Lemon tree', aka: ['Citrus'], latin: 'Citrus × limon', category: 'fruit',
    waterDays: 5, water: 'Deep soak, then let the top few centimetres dry.',
    light: 'Full sun, sheltered from cold wind.',
    repotMonths: 30, frostTender: true,
    harvest: { kind: 'seasonal', seasons: ['autumn', 'winter', 'spring'], how: 'Pick when fully coloured and slightly soft. Fruit keeps well on the tree, so take it as you need it.' },
    tips: ['Feed with citrus fertiliser at the end of winter and again in late summer.', 'Remove any shoots from below the graft.'],
    signs: {
      yellow: 'Yellow leaves with green veins mean it is hungry. Feed with citrus fertiliser and a dose of iron chelate, and water it in well.',
      flowering: 'Blossom means fruit is setting. Keep water steady; a dry spell now makes it drop the baby fruit.',
      pests: 'Squiggly silver trails are citrus leafminer; spray new growth with horticultural oil. Lumps on stems are scale; same oil works.',
    },
  },
  {
    key: 'fig', name: 'Fig tree', latin: 'Ficus carica', category: 'fruit',
    waterDays: 5, water: 'Regular deep watering while fruit swells.',
    light: 'Full sun.',
    repotMonths: 30,
    harvest: { kind: 'seasonal', seasons: warm, how: 'Ripe figs droop on the stem and feel soft. Pick them then, they do not ripen off the tree.' },
    tips: ['Prune in winter while it is bare.', 'Net against birds as fruit colours.'],
  },
  {
    key: 'blueberry', name: 'Blueberry', latin: 'Vaccinium', category: 'fruit',
    waterDays: 3, water: 'Keep moist. Rainwater is best, it dislikes hard tap water.',
    light: 'Sun to part shade.',
    repotMonths: 24,
    harvest: { kind: 'seasonal', seasons: ['spring', 'summer'], how: 'Wait a few days after they turn blue. Ripe ones fall off with a gentle roll of the thumb.' },
    tips: ['Needs acidic soil. Use azalea and camellia potting mix.'],
    signs: { yellow: 'The soil is probably not acidic enough. Repot into azalea mix or add sulphur, and water with rainwater.' },
  },
  {
    key: 'passionfruit', name: 'Passionfruit', latin: 'Passiflora edulis', category: 'fruit',
    waterDays: 4, water: 'Deep watering twice a week in warm weather.',
    light: 'Full sun with something to climb.',
    repotMonths: 24, frostTender: true,
    harvest: { kind: 'seasonal', seasons: warm, how: 'Ripe fruit drops to the ground. Collect them, and eat once the skin wrinkles.' },
    tips: ['Feed in spring and summer with a fruit fertiliser.'],
    signs: { flowering: 'If flowers drop without fruit, hand pollinate with a small brush and keep the water steady.' },
  },
  {
    key: 'avocado', name: 'Avocado', latin: 'Persea americana', category: 'fruit',
    waterDays: 5, water: 'Deep but infrequent. Never leave it sitting in wet soil.',
    light: 'Full sun, out of strong wind.',
    repotMonths: 24, frostTender: true,
    harvest: { kind: 'seasonal', seasons: ['autumn', 'winter', 'spring'], how: 'Pick when full size and the skin dulls (Hass turns dark). Avocados only soften off the tree, so ripen them on the bench for a few days.' },
    tips: ['Excellent drainage matters more than anything else.', 'Mulch thickly but keep it off the trunk.'],
    signs: { brown_tips: 'Usually salt build-up from tap water or fertiliser. Give it a long, slow flush with plenty of water once a month.' },
  },

  // ───────── Houseplants
  {
    key: 'monstera', name: 'Monstera', aka: ['Swiss cheese plant', 'Fruit salad plant'], latin: 'Monstera deliciosa', category: 'houseplant',
    waterDays: 9, water: 'Water when the top 5 cm of soil is dry.',
    light: 'Bright, indirect light.',
    repotMonths: 24, frostTender: true,
    tips: ['Wipe the leaves with a damp cloth so they can breathe.', 'Give it a moss pole to climb for bigger, split leaves.'],
    signs: { leggy: 'Small leaves without splits and long gaps mean it wants more light. Move it closer to a window, out of direct sun.', roots_out: 'Aerial roots are normal; tuck them into the pot or pole. Roots circling out of the drainage holes mean it is time to size up.' },
  },
  {
    key: 'pothos', name: 'Pothos', aka: ["Devil's ivy"], latin: 'Epipremnum aureum', category: 'houseplant',
    waterDays: 9, water: 'Let the top half of the soil dry out. It droops when thirsty and bounces back.',
    light: 'Low to bright indirect light.',
    repotMonths: 24, frostTender: true,
    tips: ['Trim long vines to keep it full. Cuttings root easily in water.'],
    signs: { leggy: 'Cut the long bare vines back to a few centimetres from the soil. Pop the cuttings in water and replant them into the same pot once rooted.' },
  },
  {
    key: 'snake-plant', name: 'Snake plant', aka: ["Mother-in-law's tongue", 'Sansevieria'], latin: 'Dracaena trifasciata', category: 'houseplant',
    waterDays: 18, water: 'Let it dry out completely. When in doubt, wait.',
    light: 'Anything from low light to bright.',
    repotMonths: 36, frostTender: true,
    tips: ['Overwatering is the only real way to kill it.'],
    signs: { soil_dry: 'Dry is how it likes it. Only water if it has been two weeks or more.', yellow: 'Soft yellow leaves mean too much water. Stop watering until the soil is dry right through.' },
  },
  {
    key: 'zz-plant', name: 'ZZ plant', aka: ['Zanzibar gem'], latin: 'Zamioculcas zamiifolia', category: 'houseplant',
    waterDays: 18, water: 'Let it dry out completely between waterings.',
    light: 'Low to bright indirect light.',
    repotMonths: 36, frostTender: true,
    tips: ['It stores water in its bulbs, so it forgives neglect.'],
    signs: { soil_dry: 'Dry is how it likes it. Only water if it has been two weeks or more.', yellow: 'Too much water. Let the soil dry out fully before the next drink.' },
  },
  {
    key: 'peace-lily', name: 'Peace lily', latin: 'Spathiphyllum', category: 'houseplant',
    waterDays: 6, water: 'Keep lightly moist. It droops dramatically when thirsty.',
    light: 'Low to medium indirect light.',
    repotMonths: 18, frostTender: true,
    tips: ['Brown tips often come from tap water. Try filtered or rainwater.'],
    signs: { wilting: 'Classic peace lily drama. Give it a thorough drink and it will stand back up within hours.', flowering: 'The white flowers last for weeks. Cut each stalk at the base when it turns green or brown.' },
  },
  {
    key: 'fiddle-leaf', name: 'Fiddle leaf fig', latin: 'Ficus lyrata', category: 'houseplant',
    waterDays: 9, water: 'Water thoroughly when the top 5 cm is dry, then let it drain.',
    light: 'Lots of bright, indirect light.',
    repotMonths: 24, frostTender: true,
    tips: ['Pick a bright spot and leave it there. It sulks when moved.', 'Turn the pot a quarter each month for even growth.'],
    signs: { spots: 'Brown patches spreading from the middle of leaves mean root rot from overwatering. Brown edges mean it got too dry.', yellow: 'Dropping lower leaves is usually a draught, a move, or not enough light.' },
  },
  {
    key: 'rubber-plant', name: 'Rubber plant', latin: 'Ficus elastica', category: 'houseplant',
    waterDays: 9, water: 'Water when the top 5 cm is dry.',
    light: 'Bright, indirect light.',
    repotMonths: 24, frostTender: true,
    tips: ['Wipe dust off the leaves monthly.'],
  },
  {
    key: 'spider-plant', name: 'Spider plant', latin: 'Chlorophytum comosum', category: 'houseplant',
    waterDays: 7, water: 'Water when the top 2 cm is dry.',
    light: 'Bright to medium indirect light.',
    repotMonths: 18, frostTender: true,
    tips: ['The baby plants on runners can be potted up.'],
    signs: { brown_tips: 'Very common, caused by fluoride and salts in tap water. Use rainwater or filtered water and trim the tips.' },
  },
  {
    key: 'philodendron', name: 'Philodendron', latin: 'Philodendron', category: 'houseplant',
    waterDays: 8, water: 'Water when the top 3 cm is dry.',
    light: 'Medium to bright indirect light.',
    repotMonths: 24, frostTender: true,
    tips: ['Trim just above a leaf to encourage fuller growth.'],
  },
  {
    key: 'calathea', name: 'Calathea', latin: 'Goeppertia', category: 'houseplant',
    waterDays: 6, water: 'Keep evenly moist with filtered or rainwater.',
    light: 'Medium indirect light. No direct sun.',
    repotMonths: 24, frostTender: true,
    tips: ['Loves humidity. A bathroom or a pebble tray helps.'],
    signs: { brown_tips: 'Dry air or tap water. Switch to rainwater and raise humidity with a pebble tray or by grouping plants.' },
  },
  {
    key: 'fern', name: 'Fern', latin: 'Nephrolepis exaltata', category: 'houseplant',
    waterDays: 4, water: 'Never let it dry out. Keep the soil lightly damp.',
    light: 'Bright shade. No direct sun.',
    repotMonths: 18, frostTender: true,
    tips: ['Mist it or keep it somewhere humid.'],
    signs: { brown_tips: 'It dried out or the air is too dry. Trim the crispy fronds at the base, water more often and move it away from heaters.' },
  },
  {
    key: 'orchid', name: 'Orchid', aka: ['Moth orchid', 'Phalaenopsis'], latin: 'Phalaenopsis', category: 'houseplant',
    waterDays: 8, water: 'Soak the pot for ten minutes, then drain fully. Water when roots turn silvery.',
    light: 'Bright, indirect light.',
    repotMonths: 24, frostTender: true,
    tips: ['Green roots mean wet enough. Silver roots mean thirsty.', 'Grow it in orchid bark, never normal potting mix.'],
    signs: { flowering: 'Flowers last two to three months. When they finish, cut the spike just above the second node from the base to try for a rebloom.', roots_out: 'Roots growing in the air are normal for orchids. Only repot when the bark has broken down or roots are packed tight.' },
  },
  {
    key: 'bird-of-paradise', name: 'Bird of paradise', latin: 'Strelitzia', category: 'houseplant',
    waterDays: 8, water: 'Water when the top 5 cm is dry.',
    light: 'As much bright light as you can give it.',
    repotMonths: 24, frostTender: true,
    tips: ['Split leaves are natural, not damage.'],
  },

  // ───────── Succulents
  {
    key: 'aloe', name: 'Aloe vera', latin: 'Aloe vera', category: 'succulent',
    waterDays: 16, water: 'Soak, then let it dry out completely.',
    light: 'Bright light with some direct sun.',
    repotMonths: 24, frostTender: true,
    harvest: { kind: 'continuous', how: 'Cut a thick outer leaf at the base when you need gel.' },
    tips: ['Pot up the pups that appear around the base.'],
  },
  {
    key: 'jade', name: 'Jade plant', latin: 'Crassula ovata', category: 'succulent',
    waterDays: 16, water: 'Water when the leaves feel slightly soft.',
    light: 'Bright light, some direct sun.',
    repotMonths: 36, frostTender: true,
    tips: ['Wrinkled leaves mean thirsty. Mushy leaves mean too wet.'],
  },
  {
    key: 'succulent', name: 'Succulent', aka: ['Sedum'], latin: 'Various', category: 'succulent',
    waterDays: 14, water: 'Soak and dry. Water only when the soil is bone dry.',
    light: 'Bright light with a few hours of direct sun.',
    repotMonths: 24, frostTender: true,
    tips: ['Use gritty cactus mix and a pot with drainage holes.'],
  },
  {
    key: 'cactus', name: 'Cactus', latin: 'Cactaceae', category: 'succulent',
    waterDays: 21, water: 'Sparingly. Barely any in winter.',
    light: 'Full sun.',
    repotMonths: 36,
    tips: ['Use cactus mix and never let it sit in water.'],
  },

  // ───────── Flowers and shrubs
  {
    key: 'rose', name: 'Rose', latin: 'Rosa', category: 'flower',
    waterDays: 4, water: 'Deep soak at the base twice a week. Keep leaves dry.',
    light: 'Full sun, 6+ hours.',
    repotMonths: 30,
    tips: ['Prune hard in late winter.', 'Feed with rose food in spring and after each flush.'],
    signs: { flowering: 'Cut finished blooms back to the first leaf with five leaflets. That triggers the next round of flowers.', spots: 'Black spot. Bin affected leaves, water only at the base, and spray new growth with a rose fungicide or diluted milk.', pests: 'Aphids love new rose buds. Squash them or hose them off. Ladybirds will help.' },
  },
  {
    key: 'lavender', name: 'Lavender', latin: 'Lavandula', category: 'flower',
    waterDays: 9, water: 'Let it dry out between waterings. Hates wet feet.',
    light: 'Full sun.',
    repotMonths: 24,
    harvest: { kind: 'seasonal', seasons: ['spring', 'summer'], how: 'Cut flower stems just as the buds open, in the morning, for drying.' },
    tips: ['Trim by a third after flowering, but never into bare wood.'],
    signs: { flowering: 'Cut stems for drying now, or leave them for the bees. Shear the plant by a third once the flowers fade.', yellow: 'Too wet. Lavender needs to dry out and wants gritty, free-draining soil.' },
  },
  {
    key: 'hydrangea', name: 'Hydrangea', latin: 'Hydrangea macrophylla', category: 'shrub',
    waterDays: 3, water: 'Thirsty. Water deeply and often in warm weather.',
    light: 'Morning sun, afternoon shade.',
    repotMonths: 24,
    tips: ['Prune in late winter, down to a pair of fat buds.'],
    signs: { wilting: 'Hydrangeas flop in afternoon heat even when the soil is damp. Water deeply in the morning and give it afternoon shade.' },
  },
  {
    key: 'geranium', name: 'Geranium', aka: ['Pelargonium'], latin: 'Pelargonium', category: 'flower',
    waterDays: 6, water: 'Let the top of the soil dry between waterings.',
    light: 'Full sun.',
    repotMonths: 18, frostTender: true,
    tips: ['Snap off spent flower stalks at the base.'],
    signs: { leggy: 'Cut the stems back by half, just above a leaf joint. The cuttings will root if you push them into damp potting mix.' },
  },
  {
    key: 'camellia', name: 'Camellia', latin: 'Camellia japonica', category: 'shrub',
    waterDays: 5, water: 'Keep evenly moist, especially while buds form.',
    light: 'Part shade, out of hot afternoon sun.',
    repotMonths: 30,
    tips: ['Use azalea and camellia mix. It needs acidic soil.'],
    signs: { yellow: 'Yellow leaves with green veins mean the soil is not acidic enough. Feed with azalea and camellia food and a dose of iron chelate.' },
  },
  {
    key: 'bougainvillea', name: 'Bougainvillea', latin: 'Bougainvillea', category: 'shrub',
    waterDays: 8, water: 'Keep on the dry side. It flowers best when slightly stressed.',
    light: 'Full sun.',
    repotMonths: 36, frostTender: true,
    tips: ['Prune after each flush of flowers.'],
  },
  {
    key: 'hibiscus', name: 'Hibiscus', latin: 'Hibiscus rosa-sinensis', category: 'shrub',
    waterDays: 4, water: 'Regular water in warm weather.',
    light: 'Full sun.',
    repotMonths: 24, frostTender: true,
    tips: ['Prune by a third in early spring.'],
  },
  {
    key: 'jasmine', name: 'Jasmine', latin: 'Jasminum', category: 'shrub',
    waterDays: 5, water: 'Keep moist in spring and summer.',
    light: 'Sun to part shade.',
    repotMonths: 24,
    tips: ['Prune straight after flowering.'],
  },
  {
    key: 'native-shrub', name: 'Australian native', latin: 'Various', category: 'shrub',
    waterDays: 10, water: 'Deep but infrequent once established.',
    light: 'Full sun.',
    repotMonths: 30,
    tips: ['Only use low-phosphorus native fertiliser.', 'Tip prune after flowering to keep it bushy.'],
    signs: { yellow: 'Often phosphorus poisoning from ordinary fertiliser. Switch to a native plant food and flush the soil with water.' },
  },
  {
    key: 'sunflower', name: 'Sunflower', latin: 'Helianthus annuus', category: 'flower',
    waterDays: 3, water: 'Deep watering as it grows tall.',
    light: 'Full sun.',
    repotMonths: 6, frostTender: true,
    tips: ['Stake tall varieties.'],
  },
  {
    key: 'annual-flowers', name: 'Petunias', aka: ['Impatiens', 'Annual flowers'], latin: 'Various', category: 'flower',
    waterDays: 2, water: 'Keep moist. Pots and baskets may need water daily in summer.',
    light: 'Sun to part shade.',
    repotMonths: 6, frostTender: true,
    tips: ['Pinch off dead flowers every few days for months of colour.'],
    signs: { leggy: 'Cut the whole plant back by half and feed it. It will bush out and flower again in two to three weeks.' },
  },
  {
    key: 'agapanthus', name: 'Agapanthus', latin: 'Agapanthus', category: 'flower',
    waterDays: 8, water: 'Tough once established. Water in dry spells.',
    light: 'Sun to part shade.',
    repotMonths: 36,
    tips: ['Cut off seed heads after flowering so it does not spread.'],
  },
];

export const GUIDES: Guide[] = [...BASE, ...MORE_GUIDES];

const byKey = new Map(GUIDES.map((g) => [g.key, g]));

const CUSTOM: Record<Category, Omit<Guide, 'key' | 'name' | 'latin' | 'category'>> = {
  herb: { waterDays: 3, water: 'Keep lightly moist and water at the base.', light: 'Sun for most of the day.', repotMonths: 12, harvest: { kind: 'continuous', how: 'Pick little and often from the tips to keep it bushy.' }, tips: ['Remove flowers to keep leaves coming.'], signs: { flowering: pinch } },
  vegetable: { waterDays: 2, water: 'Regular, even watering at the base.', light: 'Full sun.', repotMonths: 6, harvest: { kind: 'seasonal', seasons: ['spring', 'summer', 'autumn'], how: 'Pick when it looks ready. Regular picking keeps most vegetables producing.' }, tips: ['Feed with liquid fertiliser every two weeks.'] },
  fruit: { waterDays: 5, water: 'Deep soak, then let the top dry out.', light: 'Full sun.', repotMonths: 30, harvest: { kind: 'seasonal', seasons: warm, how: 'Pick when fully coloured and it comes away easily.' }, tips: ['Feed in spring and late summer.'] },
  houseplant: { waterDays: 8, water: 'Water when the top few centimetres are dry.', light: 'Bright, indirect light.', repotMonths: 24, frostTender: true, tips: ['Wipe dust off the leaves now and then.'] },
  succulent: { waterDays: 14, water: 'Soak, then let it dry out completely.', light: 'Bright light with some direct sun.', repotMonths: 30, frostTender: true, tips: ['Gritty mix and drainage holes are essential.'] },
  flower: { waterDays: 3, water: 'Keep moist while flowering.', light: 'Sun to part shade.', repotMonths: 12, tips: ['Remove dead flowers to encourage more.'] },
  shrub: { waterDays: 6, water: 'Deep watering once or twice a week.', light: 'Sun to part shade.', repotMonths: 30, tips: ['Prune after flowering.'] },
};

export const CATEGORY_LABEL: Record<Category, string> = {
  herb: 'Herb',
  vegetable: 'Vegetable',
  fruit: 'Fruit',
  houseplant: 'House plant',
  succulent: 'Succulent or cactus',
  flower: 'Flower',
  shrub: 'Shrub or tree',
};

export function guideFor(guideKey: string, species = 'Plant'): Guide {
  const known = byKey.get(guideKey);
  if (known) return known;
  const category = (guideKey.split(':')[1] as Category) || 'houseplant';
  const base = CUSTOM[category] ?? CUSTOM.houseplant;
  return { key: guideKey, name: species, latin: CATEGORY_LABEL[category] ?? '', category, ...base };
}

export interface Match {
  guide: Guide;
  /** The name the person was probably looking for (may be an alias). */
  label: string;
}

export function searchGuides(query: string): Match[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: { m: Match; score: number }[] = [];
  for (const guide of GUIDES) {
    const names = [guide.name, ...(guide.aka ?? [])];
    let best: { label: string; score: number } | null = null;
    for (const n of names) {
      const l = n.toLowerCase();
      let score = -1;
      if (l === q) score = 100;
      else if (l.startsWith(q)) score = 80;
      else if (l.split(/[\s-]/).some((w) => w.startsWith(q))) score = 60;
      else if (l.includes(q)) score = 40;
      else if (q.includes(l)) score = 30; // "cherry tomatoes" contains "tomato"
      if (score > (best?.score ?? -1)) best = { label: n, score };
    }
    if (!best && guide.latin.toLowerCase().includes(q)) best = { label: guide.name, score: 20 };
    if (best) scored.push({ m: { guide, label: best.label }, score: best.score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, 6).map((s) => s.m);
}

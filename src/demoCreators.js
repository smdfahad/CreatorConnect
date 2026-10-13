function svgData(svg){
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function createAvatar({ background, skin, hair, shirt }){
  return svgData(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
    <defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="${background}"/><stop offset="1" stop-color="#ffffff"/></linearGradient></defs>
    <rect width="240" height="240" rx="120" fill="url(#bg)"/>
    <path d="M36 240c7-48 38-72 84-72s77 24 84 72" fill="${shirt}"/>
    <path d="M68 105c0-44 21-69 53-69 36 0 55 27 51 72l-9 30H77z" fill="${hair}"/>
    <ellipse cx="120" cy="111" rx="43" ry="53" fill="${skin}"/>
    <path d="M77 91c3-38 20-55 47-55 31 0 47 20 49 54-17-3-35-16-45-30-12 18-29 27-51 31z" fill="${hair}"/>
    <path d="M98 111h1m42 0h1" stroke="#342b31" stroke-width="5" stroke-linecap="round"/>
    <path d="M108 136c7 6 17 6 24 0" fill="none" stroke="#9a514d" stroke-width="4" stroke-linecap="round"/>
  </svg>`);
}

function createCover(background, accent){
  return svgData(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 360">
    <defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="${background}"/><stop offset="1" stop-color="#f6f3ff"/></linearGradient></defs>
    <rect width="800" height="360" fill="url(#bg)"/>
    <circle cx="650" cy="40" r="150" fill="${accent}" opacity=".18"/>
    <circle cx="160" cy="330" r="190" fill="#ffffff" opacity=".28"/>
    <path d="M390 108v144l120-72z" fill="${accent}" opacity=".58"/>
  </svg>`);
}

const creatorSeeds = [
  { id: "demo-creator-kavya-rao", name: "Kavya Rao", channelName: "Kavya's Kitchen Trails", city: "Mumbai", state: "Maharashtra", niche: "Food", subscriberCount: 84000, averageViews: 26000, budget: 8500, bio: "Home-style recipes, neighbourhood food walks, and honest reviews of independent cafes across Mumbai.", colors: ["#f6c8aa", "#d98b64", "#332421", "#bf634a"] },
  { id: "demo-creator-rohan-iyer", name: "Rohan Iyer", channelName: "Rohan Builds", city: "Bengaluru", state: "Karnataka", niche: "Technology", subscriberCount: 126000, averageViews: 41000, budget: 18000, bio: "Practical gadget reviews and clear explainers for people who want technology that just works.", colors: ["#c8d9f5", "#c78568", "#242331", "#5666ad"] },
  { id: "demo-creator-sana-qureshi", name: "Sana Qureshi", channelName: "Sana Takes The Scenic Route", city: "Delhi", state: "Delhi", niche: "Travel", subscriberCount: 72000, averageViews: 23000, budget: 9500, bio: "Weekend itineraries, thoughtful travel guides, and hidden cultural spots around India.", colors: ["#c8e8dc", "#e1a17f", "#352523", "#538c78"] },
  { id: "demo-creator-arjun-nair", name: "Arjun Nair", channelName: "Arjun Plays", city: "Hyderabad", state: "Telangana", niche: "Gaming", subscriberCount: 215000, averageViews: 78000, budget: 24000, bio: "Upbeat gameplay, beginner-friendly tips, and community-first coverage of new releases.", colors: ["#d7c8f4", "#bd8069", "#28212f", "#7354a5"] },
  { id: "demo-creator-meera-kulkarni", name: "Meera Kulkarni", channelName: "Learn With Meera", city: "Bengaluru", state: "Karnataka", niche: "Education", subscriberCount: 48000, averageViews: 19000, budget: 6000, bio: "Approachable lessons on study skills, science, and career planning for curious learners.", colors: ["#f3e0a9", "#d99b7c", "#49352a", "#a17938"] },
  { id: "demo-creator-zoya-kapoor", name: "Zoya Kapoor", channelName: "Closet Notes by Zoya", city: "Mumbai", state: "Maharashtra", niche: "Fashion", subscriberCount: 96000, averageViews: 32000, budget: 12000, bio: "Wearable styling ideas, Indian designer discoveries, and mindful wardrobe edits.", colors: ["#f3cddd", "#d99079", "#34232b", "#ac547d"] },
  { id: "demo-creator-dev-malhotra", name: "Dev Malhotra", channelName: "Everyday Strong with Dev", city: "Delhi", state: "Delhi", niche: "Fitness", subscriberCount: 63000, averageViews: 21000, budget: 7500, bio: "Realistic home workouts, beginner strength training, and sustainable wellness habits.", colors: ["#d1ead4", "#bf8467", "#322823", "#4a9563"] },
  { id: "demo-creator-ananya-bose", name: "Ananya Bose", channelName: "Ananya After Hours", city: "Hyderabad", state: "Telangana", niche: "Comedy", subscriberCount: 155000, averageViews: 54000, budget: 16500, bio: "Short sketches about work, family, and all the little surprises of everyday life.", colors: ["#f6d8ae", "#d28f72", "#392520", "#d17a45"] },
  { id: "demo-creator-ishaan-verma", name: "Ishaan Verma", channelName: "The Useful Tech Desk", city: "Mumbai", state: "Maharashtra", niche: "Technology", subscriberCount: 390000, averageViews: 118000, budget: 32000, bio: "In-depth product comparisons and practical setup guides for creators and small businesses.", colors: ["#c9e3ed", "#b97960", "#30262a", "#447d91"] },
  { id: "demo-creator-priya-menon", name: "Priya Menon", channelName: "Priya's India Journal", city: "Bengaluru", state: "Karnataka", niche: "Travel", subscriberCount: 108000, averageViews: 36000, budget: 14500, bio: "Slow travel, locally owned stays, and food-led journeys told through warm visual stories.", colors: ["#ead5c4", "#d69579", "#422e29", "#987157"] }
];

export const demoCreators = creatorSeeds.map(({ colors, ...creator }) => ({
  ...creator,
  image: createCover(colors[0], colors[3]),
  avatar: createAvatar({ background: colors[0], skin: colors[1], hair: colors[2], shirt: colors[3] }),
  engagement: Number(((creator.averageViews / creator.subscriberCount) * 100).toFixed(1)),
  platform: "YouTube",
  availability: "available",
  isDemo: true
}));

export interface MemeSound {
  name: string;
  url: string;
  category: 'Popular' | 'Graciosos' | 'Voces' | 'Videojuegos' | 'Efectos';
}

export const MEME_SOUNDS: MemeSound[] = [
  // --- POPULARES ---
  { name: "Bruh 💀", url: "https://www.myinstants.com/media/sounds/bruh.mp3", category: "Popular" },
  { name: "Taco Bell Bong 🔔", url: "https://www.myinstants.com/media/sounds/taco-bell-bong.mp3", category: "Popular" },
  { name: "Goku Ultra Instinct 💥", url: "https://www.myinstants.com/media/sounds/goku-ultra-instinct.mp3", category: "Popular" },
  { name: "SpongeBob - My Leg! 🦵", url: "https://www.myinstants.com/media/sounds/spongebob-my-leg.mp3", category: "Popular" },
  { name: "Roblox Oof 😵", url: "https://www.myinstants.com/media/sounds/oof.mp3", category: "Popular" },
  { name: "Minecraft Steve Hurt 😫", url: "https://www.myinstants.com/media/sounds/steve_hurt.mp3", category: "Popular" },
  { name: "Metal Pipe Falling 🪵", url: "https://www.myinstants.com/media/sounds/metal-pipe-falling-sound-effect-link-in-description_UOZ9z8k.mp3", category: "Popular" },
  { name: "Sad Violin / Violín Triste 🎻", url: "https://www.myinstants.com/media/sounds/sadviolin.mp3", category: "Popular" },
  { name: "Coffin Dance (Astronomia) ⚰️", url: "https://www.myinstants.com/media/sounds/astronomia-coffin-dance.mp3", category: "Popular" },
  { name: "Airhorn Accent 📣", url: "https://www.myinstants.com/media/sounds/air-horn-club-remix_XU772zR.mp3", category: "Popular" },
  { name: "Trompeta Fail (Wah Wah) 🎺", url: "https://www.myinstants.com/media/sounds/sad-troby-wah-wah-lah-v7.mp3", category: "Popular" },
  { name: "Run Meme 🏃‍♂️", url: "https://www.myinstants.com/media/sounds/run-meme.mp3", category: "Popular" },
  { name: "Rickroll (Never Gonna Give You Up) 🕺", url: "https://www.myinstants.com/media/sounds/rick-roll.mp3", category: "Popular" },
  { name: "Among Us Report 🚨", url: "https://www.myinstants.com/media/sounds/among-us-report.mp3", category: "Popular" },
  { name: "Among Us Impostor 🔪", url: "https://www.myinstants.com/media/sounds/impostor.mp3", category: "Popular" },
  { name: "FBI Open Up! 🚨", url: "https://www.myinstants.com/media/sounds/fbi-open-up-sfx.mp3", category: "Popular" },

  // --- GRACIOSOS ---
  { name: "Gemido Famoso / WhatsApp Moan 🤤", url: "https://www.myinstants.com/media/sounds/whatsapp-moan-sound-effect.mp3", category: "Graciosos" },
  { name: "Grito de Cabra Gracioso 🐐", url: "https://www.myinstants.com/media/sounds/grito-de-cabra-gracioso.mp3", category: "Graciosos" },
  { name: "Grito Wilhelm 😱", url: "https://www.myinstants.com/media/sounds/wilhelm_scream.mp3", category: "Graciosos" },
  { name: "Pedo Perfecto (Fart) 💨", url: "https://www.myinstants.com/media/sounds/perfect-fart.mp3", category: "Graciosos" },
  { name: "Risa de El Risitas (Kek) 😂", url: "https://www.myinstants.com/media/sounds/el-risitas.mp3", category: "Graciosos" },
  { name: "Risa de Ardilla Graciosa 🐿️", url: "https://www.myinstants.com/media/sounds/squirrel-laugh.mp3", category: "Graciosos" },
  { name: "Bofetada Sfx (Slap) 👋", url: "https://www.myinstants.com/media/sounds/slap-sfx.mp3", category: "Graciosos" },
  { name: "Golpe de Sartén (Bonk) 🍳", url: "https://www.myinstants.com/media/sounds/bonk.mp3", category: "Graciosos" },
  { name: "Clash Royale ¡Ji Ji Ji Ja! 👑", url: "https://www.myinstants.com/media/sounds/clash-royale-hee-hee-hee-haw.mp3", category: "Graciosos" },
  { name: "Grillos En Silencio (Crickets) 🦗", url: "https://www.myinstants.com/media/sounds/cricket.mp3", category: "Graciosos" },
  { name: "Punch Sfx (Golpe de Puño) 👊", url: "https://www.myinstants.com/media/sounds/punch.mp3", category: "Graciosos" },
  { name: "Slap Comedia Anime 🎭", url: "https://www.myinstants.com/media/sounds/slap-anime.mp3", category: "Graciosos" },
  { name: "Grito de terror largo 🙀", url: "https://www.myinstants.com/media/sounds/perfect-scream.mp3", category: "Graciosos" },
  { name: "Bocina Triste de Payaso 🤡", url: "https://www.myinstants.com/media/sounds/clown-horn.mp3", category: "Graciosos" },

  // --- VOCES ---
  { name: "Yamete Kudasai! 😩", url: "https://www.myinstants.com/media/sounds/yamete_kudasai.mp3", category: "Voces" },
  { name: "Tuturu~ (Mayuri Steins) ♪", url: "https://www.myinstants.com/media/sounds/tuturu_1.mp3", category: "Voces" },
  { name: "Ara Ara~ 😘", url: "https://www.myinstants.com/media/sounds/ara-ara.mp3", category: "Voces" },
  { name: "Anime Wow! (Loli cute) ✨", url: "https://www.myinstants.com/media/sounds/anime-wow.mp3", category: "Voces" },
  { name: "Emotional Damage! 😭", url: "https://www.myinstants.com/media/sounds/emotional-damage.mp3", category: "Voces" },
  { name: "Onii Chan! 🥰", url: "https://www.myinstants.com/media/sounds/onii-chan_Yhbe2Zc.mp3", category: "Voces" },
  { name: "Oh No, Oh No (Risa TikTok) 🛑", url: "https://www.myinstants.com/media/sounds/oh-no-no-no-tik-tok-sound-effect.mp3", category: "Voces" },
  { name: "He Boy / Yeet! 🤪", url: "https://www.myinstants.com/media/sounds/yeet.mp3", category: "Voces" },
  { name: "Nico Nico Nii! 🤟", url: "https://www.myinstants.com/media/sounds/nico-nico-nii.mp3", category: "Voces" },
  { name: "Sheesh! 😤", url: "https://www.myinstants.com/media/sounds/sheesh.mp3", category: "Voces" },
  { name: "What are you doing step bro 🤨", url: "https://www.myinstants.com/media/sounds/what-are-you-doing-step-bro.mp3", category: "Voces" },
  { name: "Gooood Morning Vietnam! 🎙️", url: "https://www.myinstants.com/media/sounds/good-morning-vietnam.mp3", category: "Voces" },
  { name: "Siuuuu! (Cristiano Ronaldo) ⚽", url: "https://www.myinstants.com/media/sounds/cr7-siuuu.mp3", category: "Voces" },

  // --- VIDEOJUEGOS ---
  { name: "Mario Bros Moneda 🪙", url: "https://www.myinstants.com/media/sounds/super-mario-coin.mp3", category: "Videojuegos" },
  { name: "Mario Bros Salto 🦘", url: "https://www.myinstants.com/media/sounds/super-mario-jump.mp3", category: "Videojuegos" },
  { name: "Mario Bros Power Up 🍄", url: "https://www.myinstants.com/media/sounds/super-mario-powerup.mp3", category: "Videojuegos" },
  { name: "Zelda Chest Open 🎁", url: "https://www.myinstants.com/media/sounds/zelda-chest.mp3", category: "Videojuegos" },
  { name: "Zelda Secret Found 🔑", url: "https://www.myinstants.com/media/sounds/zelda-secret.mp3", category: "Videojuegos" },
  { name: "GTA San Andreas Mission Passed 🏆", url: "https://www.myinstants.com/media/sounds/gta-san-andreas-mission-passed.mp3", category: "Videojuegos" },
  { name: "GTA V Wasted System ☠️", url: "https://www.myinstants.com/media/sounds/gta-v-wasted.mp3", category: "Videojuegos" },
  { name: "Pac-Man Muerte 👾", url: "https://www.myinstants.com/media/sounds/pacman-death.mp3", category: "Videojuegos" },
  { name: "Metal Gear Solid Alert (¡!) ❗", url: "https://www.myinstants.com/media/sounds/mgs-alert.mp3", category: "Videojuegos" },
  { name: "Counter Strike: Terrorists Win 💣", url: "https://www.myinstants.com/media/sounds/cs-terrorists-win.mp3", category: "Videojuegos" },
  { name: "Fortnite Default Dance 🕺", url: "https://www.myinstants.com/media/sounds/fortnite-dance.mp3", category: "Videojuegos" },

  // --- EFECTOS ---
  { name: "Suonare Trombetta (Airhorn Loud) 📣", url: "https://www.myinstants.com/media/sounds/mlg-airhorn.mp3", category: "Efectos" },
  { name: "Aplausos del Público 👏", url: "https://www.myinstants.com/media/sounds/applause_4.mp3", category: "Efectos" },
  { name: "Redoble de Tambores 🥁", url: "https://www.myinstants.com/media/sounds/drumroll.mp3", category: "Efectos" },
  { name: "Inception Horn 🧠", url: "https://www.myinstants.com/media/sounds/inceptionbutton.mp3", category: "Efectos" },
  { name: "Tussis / Tos Sfx 😷", url: "https://www.myinstants.com/media/sounds/cough.mp3", category: "Efectos" },
  { name: "SpongeBob '2000 Years Later' ⏳", url: "https://www.myinstants.com/media/sounds/spongebob-2000-years-later.mp3", category: "Efectos" },
  { name: "SpongeBob 'A Few Moments Later' ⌛", url: "https://www.myinstants.com/media/sounds/a-few-moments-later.mp3", category: "Efectos" },
  { name: "Drama Chime (Dun Dun Duuun!) 😮", url: "https://www.myinstants.com/media/sounds/drama.mp3", category: "Efectos" },
  { name: "Explosión Sfx 🎆", url: "https://www.myinstants.com/media/sounds/explosion.mp3", category: "Efectos" },
  { name: "Campana de Boxeo 🥊", url: "https://www.myinstants.com/media/sounds/boxing-bell.mp3", category: "Efectos" },
  { name: "Disparo de Pistola Sfx 🔫", url: "https://www.myinstants.com/media/sounds/gunshot.mp3", category: "Efectos" },
  { name: "Sonido de Monedas Cayendo 🪙", url: "https://www.myinstants.com/media/sounds/coins-falling.mp3", category: "Efectos" },
];

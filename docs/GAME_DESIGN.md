# MiniMe StrongMe — Design Doc

## Ringkasan
Hyper-casual rogue-like tower defense (mirip Vampire Survivors / Survivor.io, 2D minimalis pixel art), portrait. Satu karakter diam di tengah layar menembak musuh otomatis. Tidak ada joystick; pemain hanya menyentuh layar untuk memilih kartu upgrade dan tombol menu. Hook: kombinasi upgrade acak yang menghasilkan synergy berbeda tiap run.

## Core loop
1. Wave mulai, musuh spawn di luar tepi layar dari sudut acak, berjalan lurus ke pemain.
2. Pemain menembak otomatis ke musuh terdekat.
3. Semua musuh wave tewas -> game pause -> pilih 1 dari 3 kartu upgrade acak.
4. 10 wave. Wave 5 = mini-boss (golem), wave 10 = boss akhir (boss golem). Menang jika wave 10 selesai.
5. HP habis = kehilangan 1 nyawa (3 nyawa). Nyawa habis = Game Over. Skor = wave tercapai + total kill.

## Tampilan (acuan mockup)
Arena: lingkaran jalan batu di tengah rumput, karakter di tengah lingkaran rumput kecil, cincin putus-putus biru di sekitar karakter menandai jangkauan tembak. HUD: bar HP merah dengan ikon hati kiri atas, tombol pause kanan atas, bar "Wave X / 10" kiri bawah, 3 hati (nyawa) kanan bawah (hati hilang = versi gelap). Layar upgrade: panel gelap di bawah, judul "CHOOSE YOUR UPGRADE", 3 kartu berdampingan.

## Upgrade (id = nama ikon ui_icon_<id>)
Setiap upgrade: id, name, icon, deskripsi per level, maxLevel 5, tags.
- damage: Damage +20% (stat)
- attack_speed: Attack Speed +15% (stat)
- max_hp: Max HP +20 dan heal 20 (stat) [ikon ui_icon_max_hp]
- proj_speed: Projectile Speed +15% (stat)
- crit: Crit Chance +10%, crit = damage x2 (stat)
- multishot: +1 peluru per level, menyebar kipas (projectile)
- piercing: peluru tembus +1 musuh per level (projectile)
- bounce_bullet: peluru memantul +1 kali per level (projectile)
- bounce_blade: bilah berputar memantul antar musuh [ikon ui_icon_sword] (projectile)
- lightning: petir menyambar dan merantai antar musuh (elemental)
- meteor: Meteor Shower, meteor jatuh + ledakan area [ikon ui_icon_meteor] (elemental, aoe)
- heal_aura: pulsa penyembuh periodik [ikon ui_icon_heart] (defense)
Synergy (aktif otomatis dari kombinasi): Storm Fire (lightning + meteor), Ricochet Pierce (piercing + bounce_bullet), Fan of Blades (multishot Lv2+ + bounce_blade), Vital Storm (heal_aura + lightning), Glass Cannon (damage Lv3+ + crit Lv2+).

## Musuh
- Slime: HP 20, speed 40, dmg 10. Bat: HP 10, speed 75, dmg 6 (wave 2+). Demon: HP 45, speed 50, dmg 12, dash berkala (wave 3+). Golem: HP 160, speed 25, dmg 20 (wave 6+). Boss: boss golem (wave 5 dan 10).

## Tabel aset (public/assets/)
Semua PNG transparan dan sudah dipotong rapat. Ukuran asli besar; selalu gambar dengan ukuran tampil kecil. Ikon TIDAK semuanya persegi: gambar dengan "fit in box" (jaga rasio, di tengah kotak).

sprites/
- player.png 211x237 (tampil lebar 40) — ksatria rambut biru
- enemy_slime.png 316x276 (30)
- enemy_bat.png 428x191 (40)
- enemy_demon.png 204x204 (32)
- enemy_golem.png 236x197 (44)
- enemy_boss_golem.png 512x502 (96-110) — boss
- bullet_basic.png 268x136 (16) — peluru energi biru, menghadap kanan
- bullet_blade.png 266x275 (26) — bilah berputar
- vfx_meteor.png 272x303 (36)
- vfx_explosion.png 250x238 (56, bisa di-scale)
- vfx_aura.png 260x279 (cincin hijau, menyesuaikan radius)
- vfx_burn.png 262x343 (16) — api kecil
- vfx_hit_spark.png 384x376 (20)
- vfx_smoke_puff.png 384x362 (28)
- vfx_lightning_bolt.png 146x512 (tinggi ~60) — petir vertikal
- vfx_lightning_hit.png 281x384 (36)

ui/
- ui_panel.png 450x450 — bingkai kartu upgrade (biru berornamen, tengah transparan)
- ui_btn_blank.png 520x231 — tombol kosong (tempel teks di atasnya), tampil sekitar 140x62
- ui_logo_title.png 640x343 — logo judul
- ui_badge_synergy.png 383x384 (20) — lencana emas
- ui_banner_gameover.png 520x248, ui_banner_victory.png 520x204 (lebar ~300)
- ui_icon_life.png 360x335 — hati merah polos (HP/nyawa, tampil ~20)
- ui_icon_pause.png 274x384 — ikon pause putih (tampil ~24)
- Ikon upgrade (tampil tinggi/lebar maks 48): ui_icon_damage.png, ui_icon_attack_speed.png, ui_icon_max_hp.png, ui_icon_multishot.png, ui_icon_piercing.png, ui_icon_bounce_bullet.png, ui_icon_lightning.png, ui_icon_proj_speed.png, ui_icon_crit.png, ui_icon_sword.png (=bounce_blade), ui_icon_heart.png (=heal_aura), ui_icon_meteor.png (=meteor)

bg/
- bg_title.png 540x998 — latar title screen

app/
- app_icon.png 1024x1024 — ikon aplikasi (dipakai Fase 6)

tiles/
- tile_grass_seamless.png 256x256 dan tile_stone_seamless.png 256x256 — tekstur seamless untuk di-tile

// ── CONFIG ──
const WEBHOOK = 'https://script.google.com/macros/s/AKfycbwcRxa4BN8qvf294HWuhtCRuDaX1yH9LB_W-eCdmkmesyWcO5dMbwPQoCMdkHx83a_thA/exec';

// ── SKU DATA ──
const DIST_CATS = ["Pet Food","Accessories","Grains","Other Pet Products","Medicines & Supplements"];
const DIST_SKUS = {
  "Pet Food":[
    {code:"TO-SAL",name:"Toei Cat 20kg - Salmon"},{code:"TO-TU",name:"Toei Cat 20kg - Tuna"},
    {code:"SPL-CAT",name:"Special Cat 7kg - All Stages"},{code:"SPL-DAD",name:"Special Dog 9kg - Adult"},
    {code:"DK20",name:"Dear Kat 20kg/bag"},{code:"TD20",name:"Toei Dog 20kg/bag"},
    {code:"SPL-CUR",name:"Special Cat 7kg - Urinary"},{code:"CL10",name:"Catty Lov 10kg (400gx25)"},
    {code:"VVMA",name:"Vitality Value Meal Adult 20kg"},{code:"SPL-DPU",name:"Special Dog 9kg - Puppy"},
    {code:"DJ10",name:"Doggy Joy 10kg"},{code:"PY20-S",name:"Pet Yum Cat 20kg - Seafood"},
    {code:"DJ20",name:"Doggy Joy 20kg/bag"},{code:"FD",name:"Food For The Dog 18kg/bag"},
    {code:"PY20-C",name:"Pet Yum Cat 20kg - Carnivore"},{code:"HO AD",name:"Holistic Recipe Adult"},
    {code:"HO PU",name:"Holistic Recipe Puppy"},{code:"TOM20",name:"Tommy Cat 20kg"},
    {code:"VVMP20",name:"Vitality Value Meal Puppy 20kg"},{code:"VCL15",name:"Vitality Classic 15kg"},
    {code:"PC22.7",name:"Princess Cat All Stages"},{code:"MATS",name:"Matty Salmon"},
    {code:"MATU",name:"Matty Tuna"},{code:"AP RB",name:"Alpha Pro 5kg Regular Bites"},
    {code:"NC P10",name:"Nutrichunks Puppy 10kg"},{code:"NC A10",name:"Nutrichunks Adult 10kg"},
    {code:"MI 10",name:"Mighty Ocean Fish 10kg"},{code:"AP SB10",name:"Alpha Pro Small Bites 10kg"},
  ],
  "Accessories":[
    {code:"SP-GREEN",name:"Scratch Pen - Green 8 Lines"},{code:"SP-RED",name:"Scratch Pen - Red 16 Lines"},
    {code:"SP-LB",name:"Scratch Pen - Light Blue 17 Lines"},{code:"SP-CHP",name:"Scratch Pen - Chick Pen"},
    {code:"SP-DB",name:"Scratch Pen - Dark Blue 10 Lines"},{code:"FP-STD",name:"Flying Pen Standard"},
    {code:"CPC-L",name:"Collapsible Petcage - Large"},{code:"CPC-XL",name:"Collapsible Petcage - XL"},
    {code:"SQP-HD",name:"Square Pen Heavy Duty"},{code:"RP",name:"Rubber Pot"},
    {code:"LF12",name:'Linear Feeder 12"'},{code:"SP-BAN",name:"Scratch Pen - Bantam"},
    {code:"CPC-2XL",name:"Collapsible Petcage - 2XL"},{code:"WAM",name:"Waterer Medium"},
    {code:"CPC-M",name:"Collapsible Petcage - Medium"},{code:"WAS",name:"Waterer Small"},
    {code:"BC-DO",name:"Bird Cage - Double"},{code:"WAL",name:"Waterer Large"},
    {code:"CF-L",name:"Cup Feeder - Large"},{code:"CF-M",name:"Cup Feeder - Medium"},
    {code:"BAC-CO4",name:"Battery Cage - Coated 4 Doors"},{code:"BC-SIN",name:"Bird Cage - Single"},
    {code:"SP-BRO",name:"Scratch Pen - Breeding Pen"},{code:"BC-CPU",name:"Bird Cage - CPU"},
    {code:"CF-S",name:"Cup Feeder - Small"},{code:"BAC-CO2",name:"Battery Cage - Coated 2 Doors"},
    {code:"PM 131",name:"Plastic Matting 1x3 Black"},{code:"BC-DOAC",name:"Bird Cage - Double AC Type"},
    {code:"RG",name:"Rubber Gloves 1 set"},
  ],
  "Grains":[
    {code:"NFM",name:"Nutrena Flyer Mix"},{code:"KFM",name:"Kalapatids Flyer Mix 25kg"},
    {code:"KBM",name:"Kalapatids Breeder 25kg"},{code:"NBM",name:"Nutrena Breeder Mix"},
    {code:"GH-AF",name:"Golden Harvest - African Mix"},{code:"CC2",name:"CC2 40kg"},
    {code:"GH-BM",name:"Golden Harvest - Bird Mix"},{code:"QFM",name:"Queen Mary Flyer 25kg"},
    {code:"QBM",name:"Queen Mary Breeder 25kg"},{code:"ORDCON",name:"Ordinary Conditioner 25kg"},
    {code:"GH-CM",name:"Golden Harvest - Canary Mix"},{code:"KM",name:"Kabalen Mix 1kg"},
  ],
  "Other Pet Products":[
    {code:"FF-LV",name:"Feline Fresh - Lavender 10L"},{code:"FF-LE",name:"Feline Fresh - Lemon 10L"},
    {code:"IC LAV",name:"Ichi & Co Lavender"},{code:"IC LEM",name:"Ichi & Co Lemon"},
    {code:"FF-CO",name:"Feline Fresh - Coffee 10L"},{code:"IC SA",name:"Ichi & Co Sakura"},
    {code:"IC COF",name:"Ichi & Co Coffee"},{code:"FF-LG",name:"Feline Fresh - Lemon Grass 10L"},
    {code:"FF-AP",name:"Feline Fresh - Apple 10L"},
  ],
  "Medicines & Supplements":[
    {code:"VL-SP",name:"Supra Pills 250"},{code:"VL-IP",name:"Ideal Pills 500"},
    {code:"VL-GR",name:"Versele Laga Grits+RS 20kg"},{code:"TM-CG",name:"Cure Gold 100 Tablets"},
    {code:"FEI-B12",name:"Super B12"},{code:"RD-PW",name:"RD Power Wings 10ml"},
    {code:"TM-IO",name:"In & Out 100 Tablets"},{code:"VL-SP50",name:"Supra Pills 50 Repack"},
    {code:"AMT500",name:"Amtyl500"},{code:"FEI-HA",name:"Honey Aid 20 Tablets"},
    {code:"VL VIT4",name:"Colombine Vita 4kg"},{code:"RD-VP",name:"RD Voltplex 30s"},
    {code:"RD-DO",name:"RD Doxiplus 30s"},{code:"RD-RP",name:"RD Reload Plus 10ml"},
    {code:"LV GK100",name:"Levimin GK 100g"},{code:"TO-PR",name:"Tolome Probiotics"},
    {code:"SC",name:"Super Cee 100 Pills"},{code:"RD-CO",name:"RD Cancare 30s"},
    {code:"FEI RP",name:"Respicure 20s"},{code:"FEI-IV",name:"Iron-Vit 15ml"},
    {code:"RD-AS",name:"RD Astig 30s"},
  ],
};
const CS_BASE = {
  "Feeds":[
    {code:"10488",name:"Int1/bag"},{code:"10568",name:"Int2/bag"},{code:"10570",name:"Int2.5/bag"},
    {code:"10575",name:"Int3PLUS/bag"},{code:"10577",name:"Int4/bag"},{code:"10573",name:"Int3/bag"},
    {code:"10003",name:"Int5/bag"},
  ],
  "Grains":[
    {code:"10666",name:"QFM-Flyer/bag"},{code:"10665",name:"QBM-Breeder/bag"},
    {code:"10632",name:"CC1/bag"},{code:"10633",name:"CC2/bag"},
    {code:"10656",name:"CC3/bag"},{code:"10655",name:"Babang mais/bag"},
  ],
};


import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { AppDataSource } from '../../data-source';
import { School } from '../../modules/schools/entities/school.entity';
import { User } from '../../modules/users/entities/user.entity';
import { Vendor } from '../../modules/vendors/entities/vendor.entity';
import { VendorWallet } from '../../modules/vendors/entities/vendor-wallet.entity';
import { Item } from '../../modules/items/entities/item.entity';
import { UserRole } from '../../modules/users/user.types';
import { VendorStatus } from '../../modules/vendors/vendor.types';
import { SchoolStatus } from '../../modules/schools/school.types';
import { ItemStatus } from '../../modules/items/item.types';

const SCHOOL_SIGLE = 'LGB';
const DEFAULT_PASSWORD = 'Vendor123!';

const VENDORS_DATA = [
  {
    firstName: 'Aminata',
    lastName: 'Diallo',
    phone: '+221771234501',
    shopName: 'Chez Aminata',
    waveNumber: '+221771234501',
    items: [
      {
        name: 'Thiéboudienne',
        price: 1500,
        description: 'Riz au poisson sénégalais, légumes et sauce tomate',
        imageUrl: 'https://picsum.photos/seed/thieboudienne/400/300',
      },
      {
        name: 'Yassa Poulet',
        price: 1200,
        description: 'Poulet mariné aux oignons et citron, servi avec du riz',
        imageUrl: 'https://picsum.photos/seed/yassa-poulet/400/300',
      },
      {
        name: 'Mafé',
        price: 1000,
        description: "Ragoût à la sauce d'arachide avec viande et légumes",
        imageUrl: 'https://picsum.photos/seed/mafe/400/300',
      },
      {
        name: 'Domoda',
        price: 1200,
        description: 'Plat gambien à la pâte de tomate et arachide',
        imageUrl: 'https://picsum.photos/seed/domoda/400/300',
      },
      {
        name: 'Bissap Frais',
        price: 300,
        description: "Jus d'hibiscus sucré servi bien frais",
        imageUrl: 'https://picsum.photos/seed/bissap/400/300',
      },
    ],
  },
  {
    firstName: 'Ibrahima',
    lastName: 'Sow',
    phone: '+221771234502',
    shopName: 'Le Grill Express',
    waveNumber: '+221771234502',
    items: [
      {
        name: 'Brochettes de Poulet',
        price: 1000,
        description: 'Brochettes marinées aux épices grillées au feu de bois',
        imageUrl: 'https://picsum.photos/seed/brochettes-poulet/400/300',
      },
      {
        name: 'Merguez Grillées',
        price: 800,
        description: 'Saucisses épicées grillées servies avec pain et sauce',
        imageUrl: 'https://picsum.photos/seed/merguez/400/300',
      },
      {
        name: 'Poulet Braisé',
        price: 1500,
        description: 'Demi-poulet braisé avec sa sauce piment maison',
        imageUrl: 'https://picsum.photos/seed/poulet-braise/400/300',
      },
      {
        name: 'Sandwich Brochette',
        price: 600,
        description: 'Baguette garnie de brochette, oignons et sauce salade',
        imageUrl: 'https://picsum.photos/seed/sandwich-brochette/400/300',
      },
      {
        name: 'Jus de Gingembre',
        price: 300,
        description: 'Gingembre frais pressé avec citron et sucre',
        imageUrl: 'https://picsum.photos/seed/jus-gingembre/400/300',
      },
    ],
  },
  {
    firstName: 'Fatou',
    lastName: 'Ndiaye',
    phone: '+221771234503',
    shopName: 'Pause Déjeuner',
    waveNumber: '+221771234503',
    items: [
      {
        name: 'Sandwich Poulet',
        price: 500,
        description:
          'Baguette croustillante avec escalope de poulet et crudités',
        imageUrl: 'https://picsum.photos/seed/sandwich-poulet/400/300',
      },
      {
        name: 'Sandwich Thon',
        price: 500,
        description: 'Baguette garnie de thon, tomate, salade et mayo',
        imageUrl: 'https://picsum.photos/seed/sandwich-thon/400/300',
      },
      {
        name: 'Omelette Sandwich',
        price: 400,
        description: 'Omelette aux légumes dans une baguette beurrée',
        imageUrl: 'https://picsum.photos/seed/omelette-sandwich/400/300',
      },
      {
        name: 'Pizza Margherita',
        price: 800,
        description: 'Pizza tomate, mozzarella et basilic frais',
        imageUrl: 'https://picsum.photos/seed/pizza-margherita/400/300',
      },
      {
        name: 'Coca-Cola',
        price: 300,
        description: 'Coca-Cola 33cl bien frais',
        imageUrl: 'https://picsum.photos/seed/coca-cola/400/300',
      },
    ],
  },
  {
    firstName: 'Mariama',
    lastName: 'Bah',
    phone: '+221771234504',
    shopName: 'Le Coin Sucré',
    waveNumber: '+221771234504',
    items: [
      {
        name: 'Croissant Beurre',
        price: 300,
        description: 'Croissant pur beurre feuilleté croustillant',
        imageUrl: 'https://picsum.photos/seed/croissant/400/300',
      },
      {
        name: 'Pain au Chocolat',
        price: 350,
        description: 'Viennoiserie dorée fourrée au chocolat noir',
        imageUrl: 'https://picsum.photos/seed/pain-chocolat/400/300',
      },
      {
        name: 'Gâteau Yaourt',
        price: 400,
        description: 'Moelleux au yaourt nature, recette maison',
        imageUrl: 'https://picsum.photos/seed/gateau-yaourt/400/300',
      },
      {
        name: "Jus d'Orange Frais",
        price: 400,
        description: 'Oranges fraîches pressées minute',
        imageUrl: 'https://picsum.photos/seed/jus-orange/400/300',
      },
      {
        name: 'Glace Vanille',
        price: 300,
        description: 'Deux boules de glace artisanale à la vanille',
        imageUrl: 'https://picsum.photos/seed/glace-vanille/400/300',
      },
    ],
  },
  {
    firstName: 'Moussa',
    lastName: 'Camara',
    phone: '+221771234505',
    shopName: 'Pasta & Co',
    waveNumber: '+221771234505',
    items: [
      {
        name: 'Spaghetti Bolognaise',
        price: 1200,
        description: 'Pâtes al dente avec sauce bolognaise maison mijotée',
        imageUrl: 'https://picsum.photos/seed/spaghetti-bolognaise/400/300',
      },
      {
        name: 'Pizza 4 Fromages',
        price: 1500,
        description: 'Mozzarella, gorgonzola, emmental et chèvre',
        imageUrl: 'https://picsum.photos/seed/pizza-4-fromages/400/300',
      },
      {
        name: 'Pâtes Carbonara',
        price: 1000,
        description: 'Tagliatelles crémeux lardons, oeuf et parmesan',
        imageUrl: 'https://picsum.photos/seed/pates-carbonara/400/300',
      },
      {
        name: 'Lasagnes',
        price: 1300,
        description: 'Lasagnes maison béchamel et viande hachée',
        imageUrl: 'https://picsum.photos/seed/lasagnes/400/300',
      },
      {
        name: 'Tiramisu',
        price: 600,
        description: 'Dessert italien mascarpone, café et cacao',
        imageUrl: 'https://picsum.photos/seed/tiramisu/400/300',
      },
    ],
  },
];

async function seed() {
  await AppDataSource.initialize();

  const schoolRepo = AppDataSource.getRepository(School);
  const userRepo = AppDataSource.getRepository(User);
  const vendorRepo = AppDataSource.getRepository(Vendor);
  const vendorWalletRepo = AppDataSource.getRepository(VendorWallet);
  const itemRepo = AppDataSource.getRepository(Item);

  let school = await schoolRepo.findOne({ where: { sigle: SCHOOL_SIGLE } });
  if (!school) {
    school = await schoolRepo.save({
      name: 'Lycée Gaston Berger',
      sigle: SCHOOL_SIGLE,
      address: 'Dakar, Sénégal',
      status: SchoolStatus.ACTIVE,
    });
    console.log(`School created: ${school.name} (${school.sigle})`);
  } else {
    console.log(`School found: ${school.name} (${school.sigle})`);
  }

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  for (const vendorData of VENDORS_DATA) {
    const existingUser = await userRepo.findOne({
      where: { phone: vendorData.phone },
    });

    if (existingUser) {
      console.log(`Vendor ${vendorData.shopName} already exists — skipping.`);
      continue;
    }

    const user = await userRepo.save({
      firstName: vendorData.firstName,
      lastName: vendorData.lastName,
      phone: vendorData.phone,
      passwordHash,
      role: UserRole.VENDOR,
      schoolId: school.id,
      isOnboarded: true,
      isPhoneVerified: true,
    });

    const vendor = await vendorRepo.save({
      userId: user.id,
      schoolId: school.id,
      shopName: vendorData.shopName,
      waveNumber: vendorData.waveNumber,
      status: VendorStatus.ACTIVE,
    });

    await vendorWalletRepo.save({ vendorId: vendor.id });

    const items = vendorData.items.map((item) => ({
      vendorId: vendor.id,
      name: item.name,
      price: item.price,
      description: item.description,
      imageUrl: item.imageUrl,
      status: ItemStatus.ACTIVE,
    }));

    await itemRepo.save(items);

    console.log(
      `Vendor created: ${vendorData.shopName} (${vendorData.phone}) — ${items.length} items`,
    );
  }

  console.log('\nSeed complete.');
  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

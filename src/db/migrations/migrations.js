// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_numerous_iron_man.sql';
import m0001 from './0001_spooky_layla_miller.sql';
import m0002 from './0002_clammy_zemo.sql';
import m0003 from './0003_account_categories.sql';
import m0004 from './0004_account_number.sql';
import m0005 from './0005_qr_image.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003,
m0004,
m0005
    }
  }

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const yaml = require('js-yaml');

const INIT_DATA_FILE = 'init_data.json';
const BACKUP_FILE = 'init_data.json.bak';

// Validate team names
function validateTeams(teams) {
  if (!Array.isArray(teams) || teams.length < 2) {
    console.error('✗ エラー: 参加チームは最低2チーム必要です');
    process.exit(1);
  }
}

// Validate last inning
function validateInnings(innings) {
  const num = parseInt(innings, 10);
  if (isNaN(num) || num < 1 || num > 9) {
    console.error(`✗ エラー: 最終イニングは 1 から 9 の範囲で指定してください (入力値: ${innings})`);
    process.exit(1);
  }
  return num;
}

// Generate game_array
function generateGameArray(lastInning) {
  const array = ['試合前'];
  for (let i = 1; i <= lastInning; i++) {
    array.push(i);
  }
  array.push('試合終了');
  return array;
}

// Generate init_data.json structure
function generateInitData(gameTitle, lastInning, teamNames) {
  validateTeams(teamNames);
  const validatedInnings = validateInnings(lastInning);

  return {
    game_title: gameTitle,
    team_top: teamNames[0],
    team_bottom: teamNames[1],
    game_array: generateGameArray(validatedInnings),
    team_items: ['　', ...teamNames],
    last_inning: validatedInnings
  };
}

// Backup existing file
function backupExistingFile() {
  if (fs.existsSync(INIT_DATA_FILE)) {
    fs.copyFileSync(INIT_DATA_FILE, BACKUP_FILE);
    console.log(`✓ 既存のファイルをバックアップしました: ${BACKUP_FILE}`);
  }
}

// Save init_data.json
function saveInitData(data) {
  backupExistingFile();
  fs.writeFileSync(INIT_DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  console.log(`✓ 先攻チーム: ${data.team_top}`);
  console.log(`✓ 後攻チーム: ${data.team_bottom}`);
  console.log(`✓ ${INIT_DATA_FILE} を生成しました`);
}

// Interactive mode
async function interactiveMode() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (query) => new Promise((resolve) => rl.question(query, resolve));

  // Read existing data for default values
  let existingData = {};
  if (fs.existsSync(INIT_DATA_FILE)) {
    try {
      existingData = JSON.parse(fs.readFileSync(INIT_DATA_FILE, 'utf8'));
    } catch (err) {
      // Ignore parse errors
    }
  }

  console.log('\n野球スコアボード - 設定生成ツール');
  console.log('===================================\n');

  // Get game title
  const defaultTitle = existingData.game_title || '大会名';
  const gameTitle = await question(`大会名を入力してください [現在: ${defaultTitle}]: `);
  const finalTitle = gameTitle.trim() || defaultTitle;

  // Get last inning
  const defaultInnings = existingData.last_inning || 9;
  const lastInningInput = await question(`試合の最終イニングを入力してください [現在: ${defaultInnings}]: `);
  const finalInnings = lastInningInput.trim() || defaultInnings;

  // Get team names
  console.log('参加チーム名を入力してください [入力終了: enterのみ]:');
  const teams = [];
  let teamIndex = 1;

  while (true) {
    const teamName = await question(`  チーム ${teamIndex}: `);
    if (!teamName.trim()) {
      break;
    }
    teams.push(teamName.trim());
    teamIndex++;
  }

  rl.close();

  // Validate and generate
  if (teams.length < 2) {
    console.error('\n✗ エラー: 参加チームは最低2チーム必要です');
    process.exit(1);
  }

  const data = generateInitData(finalTitle, finalInnings, teams);
  console.log('');
  saveInitData(data);
}

// YAML file mode
function yamlFileMode(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`✗ エラー: ${filePath} が見つかりません`);
    process.exit(1);
  }

  try {
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const config = yaml.load(fileContents);

    if (!config.game_title) {
      console.error('✗ エラー: game_title が設定されていません');
      process.exit(1);
    }

    if (!config.team_names) {
      console.error('✗ エラー: team_names が設定されていません');
      process.exit(1);
    }

    const lastInning = config.last_inning || 9;
    const data = generateInitData(config.game_title, lastInning, config.team_names);
    saveInitData(data);
  } catch (err) {
    console.error(`✗ エラー: YAMLファイルの読み込みに失敗しました: ${err.message}`);
    process.exit(1);
  }
}

// Command-line arguments mode
function commandLineMode(args) {
  const options = {
    title: null,
    innings: 9,
    teams: []
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if ((arg === '--title' || arg === '-t') && nextArg) {
      options.title = nextArg;
      i++;
    } else if ((arg === '--innings' || arg === '-i') && nextArg) {
      options.innings = nextArg;
      i++;
    } else if (arg === '--teams' && nextArg) {
      options.teams = nextArg.split(',').map(t => t.trim()).filter(t => t);
      i++;
    } else if (arg === '--help' || arg === '-h') {
      showHelp();
      process.exit(0);
    }
  }

  if (!options.title) {
    console.error('✗ エラー: --title (-t) オプションは必須です');
    showHelp();
    process.exit(1);
  }

  if (options.teams.length === 0) {
    console.error('✗ エラー: --teams オプションは必須です');
    showHelp();
    process.exit(1);
  }

  const data = generateInitData(options.title, options.innings, options.teams);
  saveInitData(data);
}

// Show help
function showHelp() {
  console.log(`
野球スコアボード - 設定生成ツール

使い方:
  npm run init                    インタラクティブモードで起動
  npm run init config.yaml        YAMLファイルから生成
  npm run init -- [options]       コマンドライン引数で生成

オプション:
  -t, --title <string>      大会名 (必須)
  -i, --innings <number>    最終イニング (1-9, デフォルト: 9)
  --teams <string>          参加チーム (カンマ区切り, 必須, 最低2チーム)
  -h, --help                このヘルプを表示

例:
  npm run init -- -t "春季リーグ戦" -i 9 --teams "東京,横浜,大阪"
  npm run init config.yaml
  npm run init

YAMLファイル形式:
  game_title: 春季リーグ戦
  last_inning: 9
  team_names:
    - 東京ドラゴンズ
    - 横浜スターズ
    - 大阪タイガース
`);
}

// Main
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    // Interactive mode
    interactiveMode();
  } else if (args[0].endsWith('.yaml') || args[0].endsWith('.yml')) {
    // YAML file mode
    yamlFileMode(args[0]);
  } else {
    // Command-line arguments mode
    commandLineMode(args);
  }
}

main();

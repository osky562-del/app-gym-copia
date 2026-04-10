async function testAI() {
  const url = 'https://consejosapp.osky562.workers.dev/';
  const payload = {
    stats: { totalSessions: 12, totalVolume: 8200, streak: 4 },
    recent: [
      { date: "2026-03-20", routine: "Push", volume: 1800 },
      { date: "2026-03-22", routine: "Pull", volume: 1500 },
      { date: "2026-03-24", routine: "Legs", volume: 1900 }
    ],
    userId: "test-user-001"
  };

  process.stdout.write('--- Protesting AI Central Brain ---\n');
  process.stdout.write('URL: ' + url + '\n');

  try {
    process.stdout.write('Fetching (NO timeout)...\n');
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    process.stdout.write('Status: ' + response.status + '\n');
    const data = await response.json();
    process.stdout.write('AI Response: ' + JSON.stringify(data, null, 2) + '\n');
  } catch (error) {
    process.stderr.write('Error: ' + error.message + '\n');
  }
}

testAI();

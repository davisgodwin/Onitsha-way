import { fameOpener } from '../life/NewsFeed.js';
import { EXPR } from '../data/onitshaExpressions.js';

/*
  Data-driven conversations.
  A node = what the NPC says (an optional Onitsha expression + a generated example line) and the
  player's response options. Responses carry effects on the relationship and point to the next node.
  Conversations never move money or items themselves: they return actions (shop, job-accept,
  job-step, gift) that the Game carries out through the Economy, Inventory and JobSystem.

  Lines marked `gen` are original example dialogue written for the game (not supplied expressions);
  the UI labels them "Example dialogue".
*/

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length) % arr.length];
const form = (id, i = 0) => EXPR[id].forms[Math.min(i, EXPR[id].forms.length - 1)];

/** Compass direction from (x,z) to (tx,tz) — x east, z south. */
export function compass(x, z, tx, tz) {
  const a = Math.atan2(tx - x, -(tz - z)); // 0 = north, clockwise
  const names = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  return names[(Math.round(a / (Math.PI / 4)) + 8) % 8];
}
const fmtDist = (m) => (m < 950 ? `${Math.round(m / 50) * 50} m` : `${(m / 1000).toFixed(1)} km`);

/** Build the conversation graph for one talk. ctx: {npc, rel, player, hour, place, street, landmarks, rng} */
export function buildConversation(ctx) {
  const { npc, rel, player, rng } = ctx;
  const role = npc.role;
  const knows = rel.knowsName;
  const fam = rel.familiarity;
  const pName = player.name;
  const male = player.gender === 'male';
  const nodes = {};
  const add = (id, n) => { nodes[id] = { id, ...n }; return id; };

  // ---------------------------------------------------------------- opener
  let opener;
  if (fam >= 6) opener = { expr: 'aloba-m', form: 0, gen: `${knows ? pName + '! ' : ''}Aloba m! Where you dey since? Come, come.` };
  else if (fam >= 2) {
    if (role === 'trader') opener = { expr: 'okwa-anyi-nno', gen: `${knows ? 'Ah, ' + pName + '! ' : 'My customer! '}Okwa anyi nno ya? Business dey move small small.` };
    else if (male) opener = { expr: 'john-o', form: rng() < 0.5 ? 0 : 1, gen: `${knows ? pName + '! ' : ''}${form('john-o', 1)}! You don show again.` };
    else opener = { expr: 'how-far', form: 2, gen: `${knows ? pName + '! ' : ''}${form('how-far', 2)}? You don come back.` };
  } else if (role === 'trader') {
    opener = !male && rng() < 0.5
      ? { expr: 'asa', gen: 'Asa! Come see fine things. Everything for my shop na original.' }
      : { expr: 'mon-sir-oga', gen: 'Mon-sir oga! Welcome, welcome. Wetin you dey find today?' };
  } else if (role === 'churchgoer') {
    opener = { gen: pick(rng, ['Happy Sunday! You come for Mass?', 'Good morning, God bless you. Service go start for nine.', 'Praise the Lord! We dey wait for our people.']) };
  } else if (role === 'police') {
    opener = { gen: pick(rng, ['Good day. Drive carefully — we dey watch the road.', 'Afternoon. Keep to your lane and no overspeed.', 'Yes? Everything dey in order?']) };
  } else if (role === 'tout') opener = male ? { expr: 'senior-man', form: 0, gen: 'Senior man! You dey go somewhere? Keke full here from morning.' } : { expr: 'mon-sir-oga', gen: 'Mon-sir oga! You dey find keke?' };
  else if (role === 'hawker') opener = { expr: 'how-far', form: 0, gen: 'How far? Pure water dey, gala dey — e cold well well.' };
  else if ((ctx.reputation?.level ?? 1) >= 3) opener = male ? { expr: 'senior-man', form: 0, gen: 'Senior man! Na you people dey talk about for this ogbe. Welcome.' } : { expr: 'ogbe', gen: 'Madam! The whole ogbe know your name. Welcome.' };
  else if ((ctx.reputation?.level ?? 1) === 0) opener = { gen: 'Hmm. I don hear about you. Wetin you want?' };
  else opener = { expr: 'how-far', form: 1, gen: `${form('how-far', 1)}? You be new face for this ogbe.` };

  // v0.47 stage 8: strangers react to who you are (a familiar face still greets you as a friend)
  if (fam < 6 && ctx.fame && ctx.fame.level !== 'ordinary' && role !== 'police') { const f = fameOpener(ctx.fame, rng); if (f) opener = f; }
  if (role === 'police' && ctx.fame?.level === 'wanted') opener = { gen: `Stop there. Your name dey our notice board. Make we talk.` };

  // ---------------------------------------------------------------- hub (player options)
  const naira = (n) => '₦' + Math.round(n).toLocaleString('en-NG');
  const hubResponses = () => {
    const r = [];
    if(ctx.mission)r.push({label:ctx.mission.kind==='offer'?'I am looking for my friend.':'My guy, I don find you!',next:ctx.mission.kind==='offer'?'mission-offer':'mission-welcome'});
    // job hand-ins come first
    const js = ctx.jobStep;
    if (js) {
      const giverName = ctx.jobGiverName ?? 'your customer';
      const label = js.do === 'deliver' ? `I bring parcel from ${giverName}.`
        : js.do === 'pickup' ? `I come collect goods for ${giverName}.`
          : js.do === 'return' ? 'I don bring your goods.'
            : `I don buy the ${ctx.jobItemName ?? 'thing'} wey you send me.`;
      r.push({ label, action: { type: 'job-step' }, next: { ok: 'job-paid', advanced: 'job-picked', fail: 'job-missing', expired: 'job-late' } });
    }
    for (const c of ctx.crime ?? []) r.push({ label: c.label, action: { type: 'crime', kind: c.kind }, next: null });
    for (const o of ctx.supplyOrders ?? []) r.push({ label: `I bring your ${o.qty} × ${o.itemName}.`, action: { type: 'supply', order: o.id }, next: { ok: 'supply-paid', fail: 'supply-missing', expired: 'supply-late' } });
    if (ctx.canShop) r.push({ label: role === 'hawker' ? 'I wan buy something.' : 'Make I see your goods.', action: { type: 'shop' }, next: null });
    if (ctx.jobOffer) r.push({ label: 'You get any small work for me?', next: 'job-offer' });
    if (ctx.giftable?.length) r.push({ label: 'I get small something for you.', next: 'gift' });
    if (!rel.knowsName) r.push({ label: `My name na ${pName}.`, effect: { knowsName: true, positive: 1 }, next: 'intro' });
    r.push({ label: 'Kee kosi! I dey fine.', expr: 'how-far', form: 1, effect: { positive: 1 }, next: 'smalltalk' });
    if (role === 'trader') r.push({ label: 'How market today?', next: 'business' });
    if (role !== 'trader') r.push({ label: 'Wetin dey happen for this area?', next: 'area' });
    r.push({ label: 'Abeg, how I go reach…', next: 'directions' });
    r.push({ label: 'Ka anyi waa. Make I dey go.', expr: 'ka-anyi-waa', form: 0, next: fam >= 4 && !rel.invitedDay ? 'invite' : 'farewell' });
    return r;
  };
  add('open', { ...opener, responses: hubResponses() });
  add('hub', { gen: pick(rng, ['Wetin else?', 'Talk your own.', 'I dey hear you.']), responses: hubResponses() });
  if(ctx.mission){
    add('mission-offer',{gen:`Welcome to Onitsha! ${ctx.mission.friend??'Your friend'} is at the home gate nearby. Go and greet them. They kept ₦500 to help you settle in. Follow the mission marker; if they are out, check their visiting hours.`,responses:[{label:'I will go and meet them.',action:{type:'mission-accept'},next:{ok:'mission-accepted',fail:'mission-unavailable'}},{label:'Not yet.',next:'hub'}]});
    add('mission-accepted',{gen:'Safe journey. Your journal has the directions. Press J or open Missions & Jobs on your phone.',responses:[{label:'Thank you. Make I go.',next:null}]});
    add('mission-welcome',{gen:'How far! You made it. Welcome to the neighbourhood. The markets are busy, so keep your bag close. Eat, rest and ask people for directions. Here is the ₦500 I kept for you to settle in.',responses:[{label:'Thank you, my friend. I am ready to settle in.',effect:{knowsName:true,positive:1},action:{type:'mission-finish'},next:{ok:'mission-done',fail:'mission-unavailable'}}]});
    add('mission-done',{gen:'You are welcome. Take your time and get to know the city.',responses:[{label:'See you around.',next:null}]});
    add('mission-unavailable',{gen:'We cannot finish that right now. Check your mission journal and speak to the right person here in the city.',responses:[{label:'Okay.',next:null}]});
  }
  add('intro', { gen: `${pName}! Nice name. Me, na ${npc.name}. ${role === 'trader' ? 'Anytime you need something, come my shop.' : 'You go see me around this side.'}`, responses: [{ label: 'Okay o.', next: 'hub' }] });

  // ---------------------------------------------------------------- small talk (role-aware gossip using supplied expressions)
  const talkPool = role === 'trader'
    ? [
      { expr: 'ikwapu-ikwata', gen: 'Business dey steady — ikwapu ikwata. No shaking.' },
      { expr: 'mgbago', gen: 'My oga just come back from Mgbago with new goods. Fresh stock everywhere.' },
      { expr: 'ilugo-kam', gen: 'Ilugo kam! The price wey we agree for the container don leak to everybody.' },
      { expr: 'zaa-isi', gen: 'That trader for the next line don zaa isi — e no wan reduce price for anybody.' },
    ]
    : [
      { expr: 'ogbe', gen: 'This ogbe no dey sleep. Keke horn from morning till night.' },
      { expr: 'a-big-ime-afia', gen: 'You see that black saloon car wey pass? Na one a-big ime afia from Main Market get am.' },
      { expr: 'i-gbu-ozu', gen: 'Dem say one boy for this street don gbu ozu — him dey drive big jeep now.' },
      { expr: 'kom-miss', gen: 'Kom miss send me go market. I just dey waka reach.' },
      { expr: 'tiwaa-slate', gen: 'My younger brother na tiwaa slate. First position again this term!' },
      { expr: 'ona-ata-mgbe', gen: "The other one? O'na ata mgbe. P-man don catch am two times." },
      { expr: 'onye-okuku', gen: 'My guy na onye ọkụkụ — money no dey stay for him hand at all.' },
      { expr: 'owu-ite', gen: 'Things hard o. Owu ite for some families this year.' },
      { expr: 'language', form: 1, gen: 'Poa language — wetin be the plan today?' },
    ];
  const talk = pick(rng, talkPool);
  add('smalltalk', {
    ...talk,
    responses: [
      { label: 'Okwu gi kwu oto ka siga!', expr: 'okwu-gi-kwu-oto', effect: { positive: 1 }, next: 'agree' },
      { label: 'Ina-ako tuuu park!', expr: 'ina-ako-tuuu', effect: { playful: 1 }, next: 'disagree' },
      { label: 'Anọ m na nleka…', expr: 'ano-m-na-nleka', next: role === 'trader' || role === 'tout' ? 'broke-hard' : 'broke-soft' },
      { label: 'Back', next: 'hub' },
    ],
  });
  add('agree', { gen: pick(rng, ['Na so! You sabi this place.', 'Exactly my point!', 'You hear am? Na true talk.']), responses: [{ label: 'Continue', next: 'hub' }] });
  add('disagree', { expr: 'film-agwugo', gen: 'Ehen? You no believe? Film agwugo then — I don talk my own.', responses: [{ label: 'Hahaha. Okay.', next: 'hub' }] });
  add('broke-hard', { expr: 'adiro-asi-ndo', gen: 'Adịro asi ndo — market no dey wait for anybody. Hustle harder.', responses: [{ label: 'Hmm. Okay.', next: 'hub' }] });
  add('broke-soft', { expr: 'okwa-anyi-nno', gen: 'Sorry o. E go better. Okwa anyi nno ya — keep pushing.', responses: [{ label: 'Thank you.', effect: { positive: 1 }, next: 'hub' }] });

  // ---------------------------------------------------------------- trader business & (conversation-only) bargaining
  const busy = ctx.hour >= 9 && ctx.hour < 17 && ctx.place;
  add('business', {
    ...(busy ? { expr: 'mmemme', gen: 'Mmemme today! Customers full my shop since morning.' } : rng() < 0.5 ? { expr: 'rachaa-okwa', gen: 'We dey rachaa ọkwa small small. God dey.' } : { expr: 'ote', gen: 'Everything wey I sell na ote — no fake here.' }),
    responses: [
      { label: 'How much be this one?', next: 'price' },
      { label: 'I bugonu! You don make am.', expr: 'i-bugonu', effect: { positive: 1 }, next: 'compliment' },
      { label: 'Back', next: 'hub' },
    ],
  });
  const priceExpr = pick(rng, [['fibre', 'This one na two Fibre — and I dey collect only kpọkọm.'], ['oo', 'This small one na five OO. Correct price.'], ['1-mkpa', 'This one? 1 mkpa. Na Mgbago e come from.']]);
  add('price', {
    expr: priceExpr[0], gen: priceExpr[1],
    responses: [
      { label: 'Make I see your goods.', action: { type: 'shop' }, next: null },
      { label: 'Mbada! E too cost.', expr: 'mbada', next: 'too-expensive' },
      { label: 'Okay, I go come back buy.', next: 'come-back' },
      { label: 'Back', next: 'hub' },
    ],
  });
  add('too-expensive', {
    expr: 'kpaa-ife', gen: 'Okay, okay. Because na you, I go kpaa ife small.',
    responses: [
      { label: 'Make I pay just one OO.', expr: 'oo', effect: { mood: -1 }, next: 'lowball' },
      { label: 'Fair. I go come back.', effect: { positive: 1 }, next: 'come-back' },
    ],
  });
  add('lowball', { expr: 'inye-iru-evi', gen: 'Inye iru evi?! You wan finish me? Go price am anywhere you like.', responses: [{ label: 'Sorry, sorry.', next: 'hub' }] });
  add('come-back', { gen: 'No wahala. When you ready, come — I go keep am for you.', responses: [{ label: 'Okay.', next: 'hub' }] });
  add('compliment', { gen: pick(rng, ['Ha! God dey do am. Na small small.', 'Thank you o! Na hustle.']), responses: [{ label: 'Continue', next: 'hub' }] });

  // ---------------------------------------------------------------- area talk
  add('area', {
    expr: 'ogbe', gen: role === 'tout'
      ? 'This ogbe na keke business. Upper Iweka, Main Market, Bridgehead — we dey carry everybody.'
      : `For this ogbe, everybody sabi everybody. ${ctx.place ? ctx.place + ' dey loud for day' : 'The main road dey loud'}, but inside street dey calm.`,
    responses: [{ label: 'Okay. Wetin else?', next: 'smalltalk' }, { label: 'Back', next: 'hub' }],
  });

  // ---------------------------------------------------------------- directions (computed from the real map)
  const lms = ctx.landmarks.list.filter((l) => !['district', 'plaza', 'landmark'].includes(l.kind) && Math.hypot(l.x - npc.x, l.z - npc.z) > (l.radius ?? 0))
    .map((l) => ({ l, d: Math.hypot(l.x - npc.x, l.z - npc.z) })).sort((a, b) => a.d - b.d).slice(0, 4);
  add('directions', {
    gen: 'Where you wan go?',
    responses: [
      ...lms.map(({ l, d }) => ({ label: l.name, next: 'dir:' + l.id, _d: d })),
      { label: 'Never mind', next: 'hub' },
    ],
  });
  const stop = ctx.nearestStop?.(npc.x, npc.z);
  const stopHint = stop && stop.dist < 600 ? ` The nearest bus stop na ${stop.name}, about ${fmtDist(stop.dist)} ${stop.dir} — choose where you dey go for the sign.` : '';
  for (const { l, d } of lms) {
    add('dir:' + l.id, {
      gen: `${l.name}? Face ${compass(npc.x, npc.z, l.x, l.z)} — e be like ${fmtDist(d)} from here. ${d > 1200 ? `Na far o, better enter keke.${stopHint}` : 'You fit trek am.'}`,
      responses: [{ label: 'Thank you!', effect: { positive: 1 }, next: 'hub' }],
      action: { type: 'waypoint', landmark: l.id },
    });
  }

  // ---------------------------------------------------------------- jobs
  const offer = ctx.jobOffer;
  if (offer) {
    const where = ctx.jobWhere ? ` — ${ctx.jobWhere}` : '';
    const due = ctx.jobDue ? ` E must reach before ${ctx.jobDue}.` : '';
    const gen = offer.type === 'deliver' ? `I get one parcel wey suppose reach ${ctx.jobTargetName}${where}. Carry am go, I go pay you ${naira(offer.reward)}.`
      : offer.type === 'collect' ? `${ctx.jobTargetName} dey hold my goods${where}. Go collect am bring come — ${naira(offer.reward)} for your hand.`
        : `Abeg help me buy ${ctx.jobItemName} — any ${offer.sellerGoods} trader get am. I go refund the money plus ${naira(offer.tip)} for your stress.`;
    add('job-offer', {
      expr: 'bia-ka-anyi-ruo', gen: gen + due,
      note: 'Up to three jobs at a time. A job not finished by its time fails: nothing is paid and the trader remembers. Keke and buses get you there faster.',
      responses: [
        { label: 'I go do am.', action: { type: 'job-accept' }, next: { ok: 'job-accepted', full: 'job-busy', fail: 'job-cant' } },
        { label: 'Not now.', next: 'hub' },
      ],
    });
  }
  add('job-accepted', { expr: 'ka-anyi-waa', form: 0, gen: 'Ka anyi waa! Make you no waste time o.', note: 'The job is in your Jobs list (J). Follow the marker on the minimap.', responses: [{ label: 'Okay', next: 'hub' }] });
  add('job-busy', { gen: 'You don carry three work for hand already. Finish one first, then come back.', responses: [{ label: 'Okay', next: 'hub' }] });
  add('job-cant', { gen: 'Hmm, e no go work like this — your bag full, or time don go. Make we try another day.', responses: [{ label: 'Okay', next: 'hub' }] });
  add('job-late', { gen: 'You come late! The time we agree don pass. I don find another person do am.', note: 'The deadline passed: the job failed and nothing was paid.', responses: [{ label: 'Sorry…', next: 'hub' }] });
  add('job-paid', { expr: 'o-suo', form: 1, gen: `O suo go nu! ${ctx.jobReward ? 'Na your ' + naira(ctx.jobReward) + ' be this.' : 'Thank you well well.'}`, responses: [{ label: 'Thank you!', effect: { positive: 1 }, next: 'hub' }] });
  add('job-picked', { gen: `Take am — handle am well o. Carry am go give ${ctx.jobGiverName ?? 'them'} sharp sharp.`, responses: [{ label: 'Okay', next: 'hub' }] });
  add('supply-paid', { expr: 'o-suo', form: 0, gen: 'O suo! Correct goods. Here your money — count am.', note: 'Supply order delivered and paid.', responses: [{ label: 'Thank you!', effect: { positive: 1 }, next: 'hub' }] });
  add('supply-missing', { gen: 'Where the complete goods? Count am well — no be this one we agree.', note: 'You need the full quantity in your bag.', responses: [{ label: 'I go bring the rest.', next: 'hub' }] });
  add('supply-late', { gen: 'Time don pass. I don buy from another person.', note: 'The order lapsed.', responses: [{ label: 'Sorry…', next: 'hub' }] });
  add('job-missing', { gen: ctx.jobStep?.do === 'bring' ? 'Where the thing? You never buy am.' : 'Where the parcel? You no carry am come.', responses: [{ label: 'Sorry, I go come back.', next: 'hub' }] });

  // ---------------------------------------------------------------- gifts (from the bag; once a day per person)
  if (ctx.giftable?.length) {
    add('gift', {
      gen: pick(rng, ['Ehn? Wetin you bring?', 'For me? Show me.']),
      responses: [
        ...ctx.giftable.map((it) => ({ label: `Give ${it.name}`, action: { type: 'gift', item: it.id }, next: { ok: 'gift-thanks', fail: 'hub' } })),
        { label: 'Never mind', next: 'hub' },
      ],
    });
    add('gift-thanks', {
      ...(fam >= 5 ? { expr: 'aloba-m', form: 0, gen: 'Aloba m! You too try. God bless you well well.' } : { gen: pick(rng, ['Ah! Thank you well well. You get good heart.', 'Chai, see better person! Thank you o.']) }),
      note: 'Gifts make people warmer to you. You can give each person one gift a day.',
      responses: [{ label: 'No wahala.', next: 'hub' }],
    });
  }

  // ---------------------------------------------------------------- invitation & farewell
  add('invite', {
    expr: 'tinyelu-m-ahu', gen: `${knows ? pName + ', ' : ''}tinyelu m ahu one day. My place no far from here.`,
    note: 'Accept and their house goes on your map. Knock between 09:00 and 21:00.',
    responses: [{ label: 'I go come!', effect: { positive: 1, invited: true, visit: true }, next: 'farewell' }, { label: 'Another time.', effect: { invited: true }, next: 'farewell' }],
  });
  add('farewell', { expr: 'ka-anyi-waa', form: 1, gen: pick(rng, ['Ka anyi tido! Waka well.', 'Ka anyi tido. Greet your people.', 'Safe journey o.']), responses: [{ label: 'Close', next: null }] });

  return nodes;
}

/** Ambient lines NPCs say to the street (speech bubbles). */
export function ambientLine(npc, ctx, rng) {
  const w = weatherLine(npc, ctx, rng); if (w) return w;
  switch (npc.role) {
    case 'churchgoer': return pick(rng, [{ gen: 'Praise the Lord!' }, { gen: 'Happy Sunday! God bless you.' }, { gen: 'Mass go soon start — make we enter.' }, { gen: 'That homily touch me today.' }]);
    case 'police': return pick(rng, [{ gen: 'Keep to your lane!' }, { gen: 'Slow down, slow down!' }]);
    case 'trader': {
      const opts = [{ expr: 'ote', gen: 'Ote! Original goods!' }, { expr: 'bia-ka-anyi-ruo', gen: 'Bia ka anyi ruo — price dey!' }];
      if (ctx.playerFemale) opts.push({ expr: 'asa', gen: 'Asa! Come see!' });
      if (ctx.busy) opts.push({ expr: 'mmemme', gen: 'Mmemme today!' });
      return pick(rng, opts);
    }
    case 'tout': return pick(rng, [{ expr: 'ka-anyi-waa', form: 0, gen: 'Ka anyi waa! Upper Iweka, Main Market!' }, { gen: 'One chance remain! Enter with your change!' }]);
    case 'hawker': return pick(rng, [{ gen: 'Pure water! Cold pure water!' }, { gen: 'Gala! Buy your gala!' }, { gen: 'Groundnut! Fresh groundnut!' }]);
    default: return pick(rng, [{ expr: 'how-far', form: 1, gen: 'Kee kosi!' }, { expr: 'john-o', form: 0, gen: 'John O!' }, { expr: 'okwa-anyi-nno', gen: 'Okwa anyi nno ya?' }]);
  }
}

/** Remarks about the weather and the power supply (game-written lines, not from the supplied list). */
export function weatherLine(npc, ctx, rng) {
  const wx = ctx.weather;
  if (wx?.rain > 0.2 && rng() < 0.55) {
    if (npc.role === 'trader') return pick(rng, [{ gen: 'This rain no go let customer come today.' }, { gen: 'Help me cover the goods — rain don start!' }]);
    if (npc.role === 'tout') return { gen: 'Rain dey fall — keke fare don go up o!' };
    return pick(rng, [{ gen: 'See as rain dey beat everybody!' }, { gen: 'This rain go flood the gutter again.' }]);
  }
  if (wx?.harmattan > 0.4 && rng() < 0.35) return pick(rng, [{ gen: 'This harmattan dust don cover everything for my stall.' }, { gen: 'Harmattan don come — my lips don crack.' }, { gen: 'Morning cold, afternoon hot. Na harmattan.' }]);
  if (ctx.power === false && rng() < 0.3) return pick(rng, [{ gen: 'NEPA don take light again!' }, { gen: 'No light since morning — na generator we dey use.' }]);
  if (ctx.sunday && npc.role !== 'tout' && rng() < 0.25) return { gen: 'Happy Sunday! You don go church?' };
  return null;
}

/** Reactions when the player bumps into someone. Escalates with repeats. */
/** A pedestrian jumping out of the way of the player's car (game-written lines, not from the supplied list). */
export function dodgeLine(close, rng) {
  if (close) return { gen: pick(rng, ['Driver! You wan kill person?', 'Chineke! You no see me?', 'Ehn! Na road you dey drive or na market?']) };
  return { gen: pick(rng, ['Slow down o!', 'Easy, driver!', 'Hey! Look where you dey go.']) };
}

export function bumpLine(count, npc, rng) {
  if (count <= 1) return { gen: pick(rng, ['Ehn! Look road o.', 'Easy! Where you dey rush go?']) };
  if (count === 2) return { expr: 'tinye-onwe-gi', gen: 'Tinye onwe gi na chain!' };
  if (count <= 4 || npc.role === 'trader') return { expr: 'gbara-ogwu', gen: 'Gbara ogwu gi ñuo!' };
  return { expr: 'm-ga-agbanyere', gen: 'M ga agbanyere gi film!' };
}

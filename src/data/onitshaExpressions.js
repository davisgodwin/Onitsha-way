/**
 * Onitsha language & culture pack.
 *
 * Expressions and meanings are stored EXACTLY as supplied by the developer (spelling, diacritics,
 * slashes and punctuation preserved). Nothing here is a verified dictionary: every entry carries
 * `verification: 'unverified'` until checked with local speakers. Variants separated by " / " are kept
 * together in `expression`; `forms` lists them individually so dialogue can use one form at a time.
 *
 * Fields
 *   id          stable key used by dialogue templates
 *   expression  the supplied expression (verbatim)
 *   forms       individual variants split from the supplied text (verbatim pieces)
 *   meaning     the supplied meaning (verbatim)
 *   supplied    for the money entries the supplied line was "<amount> — <slang>"; kept verbatim here
 *   category    A general · B money/business · C family/friends · D street/neighbourhood
 *   context     where it fits
 *   roles       NPC roles that may say it
 *   tone        friendly | business | warning | crude | neutral | reference
 *   triggers    when the dialogue engine may use it ('event:*' = only when that event happens)
 *   usable      false = reference only, never spoken by NPCs
 *   verification 'unverified' until confirmed by local speakers
 */
const E = (id, expression, meaning, o = {}) => ({
  id, expression, meaning,
  forms: o.forms ?? expression.split(' / ').map((s) => s.trim()),
  category: o.category, context: o.context ?? [], roles: o.roles ?? ['any'], tone: o.tone ?? 'neutral',
  triggers: o.triggers ?? [], usable: o.usable ?? true, verification: 'unverified', notes: o.notes ?? '', supplied: o.supplied,
});

export const EXPRESSIONS = [
  // ---------------------------------------------------------------- A. General and everyday conversation
  E('how-far', 'How far / Kee kosi / Kee way', "How are you? / What's up?", { category: 'A', context: ['greeting', 'casual'], roles: ['walker', 'neighbour', 'tout', 'hawker', 'trader'], tone: 'friendly', triggers: ['greet'] }),
  E('mon-sir-oga', 'Mon-sir oga', 'Universal greeting, regardless of the time of day.', { category: 'A', context: ['greeting', 'respectful'], roles: ['trader', 'tout', 'walker', 'neighbour'], tone: 'friendly', triggers: ['greet', 'greet-first'] }),
  E('asa', 'Asa', 'Fine girl / pretty lady.', { category: 'A', context: ['callout', 'compliment'], roles: ['trader', 'hawker'], tone: 'friendly', triggers: ['callout-female'], notes: 'Used here only as a trader’s call to a female customer.' }),
  E('ka-anyi-waa', 'Ka anyi waa / Ka anyi tido', "Let's go / let's move.", { category: 'A', context: ['farewell', 'leaving'], tone: 'friendly', triggers: ['farewell'] }),
  E('bia-ka-anyi-ruo', 'Bia ka anyi ruo', "Come let's discuss / let's reason together.", { category: 'A', context: ['invite-talk', 'business'], roles: ['trader', 'neighbour', 'tout'], tone: 'friendly', triggers: ['beckon'] }),
  E('m-ga-agbanyere', 'M ga agbanyere gi film', 'I will deal with you / teach you a lesson.', { category: 'A', context: ['threat'], roles: ['tout', 'walker'], tone: 'warning', triggers: ['event:repeated-disrespect'] }),
  E('tinye-onwe-gi', 'Tinye onwe gi na chain', 'Calm down / control yourself; warning.', { category: 'A', context: ['warning'], tone: 'warning', triggers: ['event:bump'] }),
  E('gbara-ogwu', 'Gbara ogwu gi ñuo', 'Respect yourself.', { category: 'A', context: ['warning'], tone: 'warning', triggers: ['event:bump-repeat', 'event:rude'] }),
  E('film-agwugo', 'Film agwugo', 'It is finished / the show is over.', { category: 'A', context: ['story-end'], roles: ['neighbour', 'walker', 'tout'], tone: 'neutral', triggers: ['story-end'] }),
  E('ano-m-na-nleka', 'Anọ m na nleka', 'I am broke / low on cash.', { category: 'A', context: ['money', 'hardship'], tone: 'neutral', triggers: ['player-broke', 'complain'] }),
  E('adiro-asi-ndo', 'Adịro asi ndo', "We don't care / no time for pity.", { category: 'A', context: ['dismissive'], roles: ['trader', 'tout'], tone: 'business', triggers: ['reply-broke-hard'] }),
  E('john-o', 'John O / John O John', 'How are you, bro?', { category: 'A', context: ['greeting', 'familiar'], roles: ['walker', 'neighbour', 'tout'], tone: 'friendly', triggers: ['greet-familiar'] }),
  E('okwa-anyi-nno', 'Okwa anyi nno ya', 'Hope all is well.', { category: 'A', context: ['greeting', 'familiar', 'concern'], tone: 'friendly', triggers: ['greet-familiar', 'concern'] }),
  E('ona-ata-mgbe', "O'na ata mgbe", 'He skips class / he plays truant.', { category: 'A', context: ['gossip', 'school'], roles: ['neighbour'], tone: 'neutral', triggers: ['gossip'] }),
  E('ina-ako-tuuu', 'Ina-ako tuuu park', 'You are talking total nonsense / you are lying.', { category: 'A', context: ['disagree'], tone: 'neutral', triggers: ['disagree'] }),
  E('ina-ete-amu', 'Ina ete amu gi nsi', 'You are messing up / you are loose guarding.', { category: 'A', context: ['insult'], tone: 'crude', usable: false, notes: 'Crude; kept as reference only.' }),
  E('m-na-gi-adiro', 'M na gi adiro eme ofu ihe', "We don't share things in common / we are not on the same level.", { category: 'A', context: ['snub'], tone: 'warning', triggers: ['event:snub'] }),
  E('okwu-gi-kwu-oto', 'Okwu gi kwu oto ka siga', 'You are speaking the absolute truth.', { category: 'A', context: ['agree'], tone: 'friendly', triggers: ['agree'] }),
  E('tinyelu-m-ahu', 'Tinyelu m ahu', 'Come over to my side / visit me.', { category: 'A', context: ['invite'], roles: ['neighbour', 'trader', 'walker'], tone: 'friendly', triggers: ['invite'] }),

  // ---------------------------------------------------------------- B. Money and business
  E('red', 'Red', '10 naira', { supplied: '10 naira — Red.', category: 'B', context: ['money-slang'], tone: 'business', triggers: ['price-talk'] }),
  E('green', 'Green', '20 naira', { supplied: '20 naira — Green.', category: 'B', context: ['money-slang'], tone: 'business', triggers: ['price-talk'] }),
  E('white', 'White', '50 naira', { supplied: '50 naira — White.', category: 'B', context: ['money-slang'], tone: 'business', triggers: ['price-talk'] }),
  E('oo', 'OO', '100 naira', { supplied: '100 naira — OO.', category: 'B', context: ['money-slang'], tone: 'business', triggers: ['price-talk'] }),
  E('fibre', 'Fibre', '500 naira', { supplied: '500 naira — Fibre.', category: 'B', context: ['money-slang'], tone: 'business', triggers: ['price-talk'] }),
  E('1-mkpa', '1 mkpa', '1000 naira', { supplied: '1000 naira — 1 mkpa.', category: 'B', context: ['money-slang'], tone: 'business', triggers: ['price-talk'] }),
  E('a-big-ime-afia', 'A-big ime afia', 'A rich man / big-time market trader.', { category: 'B', context: ['gossip', 'business'], roles: ['neighbour', 'walker', 'tout'], tone: 'neutral', triggers: ['gossip-rich'] }),
  E('mmemme', 'Mmemme', 'A crowded shop bustling with customers.', { category: 'B', context: ['business', 'busy'], roles: ['trader'], tone: 'business', triggers: ['business-good', 'callout'] }),
  E('rachaa-okwa', 'Rachaa ọkwa', 'Making huge profit.', { category: 'B', context: ['business', 'boast'], roles: ['trader'], tone: 'business', triggers: ['business-good'] }),
  E('language', 'Language / Poa language', 'Give me / what is the next line of action?', { category: 'B', context: ['plan'], roles: ['walker', 'neighbour', 'tout'], tone: 'friendly', triggers: ['whats-the-plan'] }),
  E('tinye-m-na-akpa', 'Tinye m na akpa', 'Give me money.', { category: 'B', context: ['money', 'request'], roles: ['tout', 'walker'], tone: 'neutral', triggers: ['ask-money'] }),
  E('ilugo-kam', 'Ilugo kam', 'The deal has cast or leaked.', { category: 'B', context: ['gossip', 'business'], roles: ['trader', 'neighbour'], tone: 'neutral', triggers: ['gossip-deal'] }),
  E('mgbago', 'Mgbago', 'Overseas, especially for traders travelling abroad to source goods.', { category: 'B', context: ['business', 'travel'], roles: ['trader'], tone: 'business', triggers: ['sourcing'] }),
  E('i-bugonu', 'I bugonu', 'You have made it big / you have grown rich.', { category: 'B', context: ['compliment'], tone: 'friendly', triggers: ['compliment-rich'] }),
  E('kpokom', 'Kpọkọm', 'Cash / money.', { category: 'B', context: ['money'], roles: ['trader', 'tout'], tone: 'business', triggers: ['price-talk', 'cash-only'] }),
  E('inye-iru-evi', 'Inye iru evi', 'Showing complete contempt for a low-price offer.', { category: 'B', context: ['bargain', 'reject'], roles: ['trader'], tone: 'business', triggers: ['lowball'] }),
  E('kpaa-ife', 'Kpaa ife', 'To slightly reduce a price for a customer.', { category: 'B', context: ['bargain'], roles: ['trader'], tone: 'business', triggers: ['bargain-ask', 'discount'] }),
  E('mbada', 'Mbada', 'Excessively expensive or someone who is massively wealthy.', { category: 'B', context: ['bargain', 'complain'], tone: 'business', triggers: ['too-expensive'] }),
  E('ote', 'Ote', 'An original, authentic product.', { category: 'B', context: ['business', 'quality'], roles: ['trader'], tone: 'business', triggers: ['product-quality', 'callout'] }),
  E('ikwapu-ikwata', 'Ikwapu ikwata', 'Stability / no shaking / fully settled.', { category: 'B', context: ['business', 'wellbeing'], roles: ['trader', 'neighbour'], tone: 'friendly', triggers: ['business-steady'] }),
  E('i-gbu-ozu', 'I gbu ozu', 'To hit it big or unexpectedly become very wealthy.', { category: 'B', context: ['gossip', 'wealth'], roles: ['neighbour', 'walker'], tone: 'neutral', triggers: ['gossip-rich'] }),
  E('o-suo', 'O suo / O suo go nu', 'Done deal / the cash has landed in abundance.', { category: 'B', context: ['deal-closed'], roles: ['trader'], tone: 'business', triggers: ['event:deal-closed'], notes: 'Only after a real completed transaction (Milestone 4).' }),

  // ---------------------------------------------------------------- C. Family and friendships
  E('kom-man', 'Kom man', 'Father / Dad.', { category: 'C', context: ['family'], roles: ['walker', 'neighbour'], tone: 'neutral', triggers: ['family-talk'] }),
  E('kom-miss', 'Kom miss', 'Mother / Mom.', { category: 'C', context: ['family'], roles: ['walker', 'neighbour'], tone: 'neutral', triggers: ['family-talk'] }),
  E('aloba-m', 'Aloba m', 'My close friend / best friend.', { category: 'C', context: ['greeting', 'friendship'], tone: 'friendly', triggers: ['greet-friend'] }),
  E('senior-man', 'Senior man / Way', 'Elder brother / Boss.', { category: 'C', context: ['address', 'respect'], roles: ['tout', 'walker', 'hawker', 'trader'], tone: 'friendly', triggers: ['address-male'] }),
  E('p-man', 'P-man', 'Principal / school authority.', { category: 'C', context: ['school', 'gossip'], roles: ['neighbour', 'walker'], tone: 'neutral', triggers: ['gossip'] }),

  // ---------------------------------------------------------------- D. Street and neighbourhood life
  E('ogbe', 'Ogbe', 'The street / neighborhood.', { category: 'D', context: ['neighbourhood'], roles: ['neighbour', 'walker', 'tout'], tone: 'neutral', triggers: ['area-talk'] }),
  E('ndi-nwa', 'Ndi nwa / Ndi eke', 'The police / law enforcement.', { category: 'D', context: ['police'], tone: 'warning', triggers: ['event:police-nearby'] }),
  E('unyaami', 'Unyaami', 'The Army.', { category: 'D', context: ['army'], tone: 'warning', triggers: ['event:army-nearby'] }),
  E('onye-imi', 'Onye imi', 'A snitch / informant.', { category: 'D', context: ['betrayal'], tone: 'warning', triggers: ['event:snitch'] }),
  E('onye-okuku', 'Onye ọkụkụ', 'A spendthrift.', { category: 'D', context: ['gossip', 'money'], roles: ['neighbour', 'walker'], tone: 'neutral', triggers: ['gossip-spender'] }),
  E('owu-ite', 'Owu ite', 'Severe poverty or hardship.', { category: 'D', context: ['hardship'], roles: ['neighbour', 'walker'], tone: 'neutral', triggers: ['hardship-talk'] }),
  E('umu-africa', 'Umu Africa / Umu Iyoo', 'Area boys / street toughs.', { category: 'D', context: ['street'], tone: 'warning', triggers: ['event:area-boys'], notes: 'Not spoken in casual chat; reserved for street events.' }),
  E('tiwaa-slate', 'Tiwaa slate', 'A scholar / highly intelligent student.', { category: 'D', context: ['school', 'praise'], roles: ['neighbour'], tone: 'friendly', triggers: ['praise-student'] }),
  E('omila', 'Omila', 'An armed robber or criminal.', { category: 'D', context: ['crime'], tone: 'warning', triggers: ['event:robbery'] }),
  E('o-chala-acha', 'O chala acha', 'A very beautiful, fair-complexioned lady.', { category: 'D', context: ['compliment'], tone: 'reference', usable: false, notes: 'Kept as reference; not used by NPCs so the game does not rank people by complexion.' }),
  E('bochaa', 'Bọchaa / Dọọ / Tikara', 'To run away or escape from the police.', { category: 'D', context: ['police'], tone: 'warning', triggers: ['event:police-chase'] }),
  E('onye-obi-akpo', 'Onye obi akpọ', 'A wicked or hard-hearted person.', { category: 'D', context: ['judgement'], tone: 'warning', triggers: ['event:cruelty'] }),
  E('nwi-nwo-nwi', 'Nwi nwo nwi', 'A police-siren imitation used to warn people that law enforcement is approaching.', { category: 'D', context: ['police', 'warning'], tone: 'warning', triggers: ['event:police-approaching'] }),
  E('kpo', 'Kpo', 'A gunshot or a general sign of danger and immediate disagreement.', { category: 'D', context: ['danger'], tone: 'warning', triggers: ['event:danger'] }),
  E('onye-mgbu', 'Onye mgbu', 'A naive outsider or someone constantly falling behind; the supplied definition also contains a potentially derogatory ethnic label.', { category: 'D', context: ['reference'], tone: 'reference', usable: false, notes: 'Preserved as reference data only. Never used to demean or target ethnic groups.' }),
  E('kpowaa', 'Kpowaa', 'To melt or dissolve into a heavy crowd to evade someone, usually the police.', { category: 'D', context: ['police', 'crowd'], tone: 'warning', triggers: ['event:police-chase'] }),
  E('zaa-isi', 'Zaa isi', 'To be extremely stubborn, excessively proud, or headstrong.', { category: 'D', context: ['gossip', 'character'], roles: ['neighbour', 'trader'], tone: 'neutral', triggers: ['gossip-stubborn'] }),
  E('kpaa-imi', 'Kpaa imi / Suo imi', 'To sabotage or betray someone; a snitch activity.', { category: 'D', context: ['betrayal'], tone: 'warning', triggers: ['event:betrayal'] }),
];

export const CATEGORY_NAMES = { A: 'General and everyday conversation', B: 'Money and business', C: 'Family and friendships', D: 'Street and neighbourhood life' };
export const EXPR = Object.fromEntries(EXPRESSIONS.map((e) => [e.id, e]));

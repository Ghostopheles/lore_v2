---
title: "The Anatomy of a Spell Cast"
pubDate: 2024-08-01
tags: ["world of warcraft"]
---

Ever wondered how spells are *actually* cast in World of Warcraft? Well, you've come to the right place. I was wondering too. Here, I'll explain (*vaguely*) how a spell is cast - from the initial button press, all the way to the server checks and the eventual server response.

TLDR at the bottom.

**Disclaimer**: The explanation below is based off of code found in [TrinityCore](https://github.com/TrinityCore/TrinityCore), which, despite it being our most reliable recreation of the retail WoW servers, is still based largely on reverse-engineering. I can't guarantee that the information below is 100% accurate, but I tried my best.

# Outline
On the surface, casting a spell seems... simple? It's not too much more than just pressing a button, and the server going 'yeah, you can cast that'. 

Before going any further, here's a broad outline of a spell cast:
- Player presses a key to cast a spell
- Client generates a spell cast **request** packet and sends it off to the server
- Server evaluates some things, then returns a spell cast packet (minus the 'request' part)
- Client receives this packet, plays necessary animations, and so on

# The Client
Locally, on your client, some magic happens in order to prepare the world for your incoming spell cast request. Step 1 is to create the packet that we'll send off to the server. Once we have this packet, we can actually send it off and the rest happens on the server-side. Except the, y'know, actually displaying the spell on the client.

## The Request Packet
I obviously can't speak to the internal order of the client, as I can't *exactly* read the code in there, but I can at least give you all the steps necessary to create the mythical SpellCastRequest packet.

When this request packet is received by the server, and the server has queued our spell, the UI receives the event `UNIT_SPELLCAST_SENT` containing the `target`, `castGUID` and `spellID` arguments.
### CastGUID
The first requirement here, is a CastID, or CastGUID. This is a unique identifier specific to this spell cast. There are many like it, but this one is yours.
### SpellID
Obviously, the server needs to know the SpellID of the spell you intend to cast. This one is self-explanatory.
### SpellVisual
Third, the visual? This one threw me off, since I figured it'd be handled by the server, not the client, but alas.

Essentially, this part of the packet is a struct containing the `SpellXSpellVisualID`, and the `ScriptVisualID`.
### Flags
Here is where we specify some flags for the spell cast. I have no idea what these are.
### Target
Now, we need to specify a target for our spell. This field is a bit more involved, as it can refer to not only a unit (NPC, creature, or player), but also an item in the case of, as an example, disenchanting.

For this struct, we need a few things:
- Some flags (?)
- A UnitGUID **OR** an ItemGUID
- The name of either the target unit or target item
Additionally, there's a few **optional** attributes we can add for (I assume) things like ground-targeted AOE spells:
- A source location
- A target location
- Orientation
- MapID
In this context, a 'location' is a struct containing a TransportGUID (?) and the XYZ coordinates of the location.

### Missile Trajectory
No, this one has nothing to do with actual missiles (depending on the spell?), instead 'missile' is a reference to any sort of moving or flying projectile relevant to the spell. An example would be the flying glaive in a Demon Hunter's 'Throw Glaive' ability.

This field boils down to a simple struct containing the requested `Pitch` and `Speed` of the projectile.
### Movement Info (Optional)
Okay, this field is quite complex so I'm just gonna boil it down to the information relevant to the spell you're trying to cast. I'd expect it to be populated on spells like Heroic Leap for warriors, or any of the Skyriding abilities.

It essentially defines what you want to happen to your character - any speed changes, a direction to fly in, a destination to jump to, etc.
### Spell Weight
I have no idea what this field is. All I can say is that it's a struct containing a `Type`, an `ID`, and a `Quantity`.
### Misc
There's a few more fields related to crafted items from professions and crafting orders and all that, but since I'm covering combat spells here, I'm not gonna bother explaining all that. It's a lot.

# The Server
The first thing the server sees is the request packet (detailed above) received from the client.

The first step for the server is to ensure the spell actually exists - if not, it does nothing.

Next, it verifies that, if the player is controlling another creature, or is controlling a vehicle, that the creature/vehicle has the spell and can cast it.

Finally, it checks if the player is able to cast the given spell in their current state. According to the TrinityCore code, the only things the server is checking here is whether the player's spells are currently on GCD (and the cast does not fall into the spell queue window) and whether or not the player is currently casting the same spell.

If all of the above checks are cleared, the server then *actually* requests the spell cast (to itself). This will do some final cleanup, like informing the client of the cancelled pending spell cast, if one was pending. If the server is currently able to execute the spell cast request, it will - otherwise it'll be queued up.

## The Second Cast Request
Once we've made it past the initial checks, we're not out of the forest just yet. There's a lot more to go.

At this point, the server resolves the caster unit to the correct unit object, and asserts that the spell being cast actually exists. After that, it checks if the player knows the spell, accounting for the `SPELL_ATTR8_SKIP_IS_KNOWN_CHECK` flag on spell.

Next, it'll verify that the spell isn't a passive spell, and that the player is not possessing another unit (like with a Priest's Mind Control).

Now, it grabs the correct spell info for the spell, taking into account the level of the target. This is, presumably, to apply level scaling and other related things to the spell before the cast.

Finally, the server creates a `SpellPrepare` packet and sends it off to the client. This packet is used by the client to display the relevant animations, begin casting, etc. Curiously, this packet contains two spell cast IDs - one for the client, and one for the server.

When the spell is actually queued up on the server side, the UI event `UNIT_SPELLCAST_SENT` is fired on the client.
## The Spell Cast
Finally, we've made it to the actual spell cast. Took a while, right? In this step, we have, you guessed it - even more checks!

I'm not going into detail about all of them because there's a lot, but it essentially boils down to checking if the spell is disabled on the server, prevents double-casting, and fills out accurate spell costs. It also queues up subsequent spells if the given spell triggers other spells.

Next up, the server sends the cooldown information to the client. This fires the `SPELL_UPDATE_COOLDOWN` event on the client (I think).

Now, the server removes any relevant auras, like Stealth, and also changes the player's 'current spell cast' on the server-side.

Finally, if all of the above successfully took place, the server sends the spell cast result to the client, and triggers the global cooldown. This can appear as many different things on the client side, depending on the spell that was cast, what type of spell it was, etc.

Possible client events that will fire depending on the spell cast results:
- `UNIT_SPELLCAST_CHANNEL_START`: For channeled spells
- `UNIT_SPELLCAST_EMPOWER_START`: For dragons
- `UNIT_SPELLCAST_FAILED`: If the spell cast failed for whatever reason
- `UNIT_SPELLCAST_START`: If the spell cast was successful and the spell has a cast time (non-instant)
- `UNIT_SPELLCAST_SUCCEEDED`: If the spell was successfully cast, and is instant cast

After all this, the spell is actually cast on the server. This will apply any final scaling numbers, calculate the final damage, update criteria, reset swing timers (if the spell rests swing timers), begin channeling for channeled spells, etc.

There's also a large number of server-side scripts that run when spells are cast, but I'm not gonna go into those.

# Recap/TLDR
That was a lot of information. A lot of somewhat complex information that probably doesn't make sense to anyone that isn't me. Lets recap from the client's perspective.

Here is a rough order of events
- Client creates a spell cast request packet detailing who they want to cast the spell on, and which spell to cast (with some other misc info)
- Server receives the packet, does about a million checks to ensure the player *can* cast that spell, then actually casts the spell server-side
- The server sends a few packets back in response to the client
	- A packet that updates the client's spell cooldowns
	- A packet that updates the client's global cooldown
	- A packet containing the results of the spell cast request
	- A packet telling the client that the spell is actually casting

Doesn't sound super complicated, right? Afterall, I was able to follow it pretty well (lol). I would expect that the actual Blizzard source code is quite a bit more optimized than that of TrinityCore, at least. There's also probably a number of additional checks in the real world.

Though the most impressive part about this all, to me, is that this delicate dance of back and forth communication with the server happens for *every single* spell cast from *every single* player. As far as I know, there is not a single spell evaluated entirely on the client.

That means that for your average raid boss encounter you could have more than **40+** spell cast request *per second*, and the server is able to handle this load gracefully, replying to each client in (ideally) less than 80 milliseconds.

Now imagine battlegrounds like Ashran. You can have a *lot* more than 40 players fighting in those - and many times more for special events like the current TWW pre-patch event. So when you're wondering why the 'small indie company' can't just upgrade their servers - think of the insane number of things happening every single second on the server to keep this game running healthy.

There's even more things I didn't go into such as combat logging and the world server, etc. Maybe I'll do a write up on those topics in the future.
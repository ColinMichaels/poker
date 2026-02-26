<template>
    <game-rules :name="name">
        <template v-slot:heading>
            <div>
                <h2>Seven Card Stud:</h2>
                <p>Seven-card stud is played with two downcards and one upcard dealt before the first betting round, followed by three more upcards (with a betting round after each card) and one more downcard. After the last downcard is dealt, there is a final round of betting. The best five-card poker hand wins the pot. In all fixed-limit games, the smaller bet is wagered on the first two betting rounds, and the larger bet is wagered after the betting rounds on the fifth, sixth, and seventh cards. If there is an open pair on the fourth card, any player has the option of making the smaller or larger bet. Deliberately changing the order of your upcards in a stud game is improper because it unfairly misleads the other players.</p>
            </div>
        </template>
        <template v-slot:rounds>
            <div>
                <h3>Rounds of Betting:</h3>
                <strong>OBJECT:</strong>
                The best five-card poker hand, out of seven cards, wins the pot.
                <ul class="numbered">
                    <li>Each player must place an ante into the pot.</li>
                    <li>Each player is dealt two cards face down (hole cards) and one card face up (door card)</li>
                    <li>
                        <div class="deck seven-card-stud-hole">
                            <h6>Hole Cards<span class="door">Door Card</span></h6>
                            <h6>Flop</h6>
                            <div class="cards" >
                                <card name="4H"></card>
                                <card name="10C"></card>
                                <card name="3H" :is_flipped="true"></card>
                            </div>
                        </div>
                    </li>
                    <li>First betting round.</li>
                    <li>Each player is dealt one card face up (fourth street)</li>
                    <li>
                        <div class="deck seven-card-stud-hole">
                            <h6>HoleCards <span class="door">Door Card</span></h6>
                            <div class="cards" >
                                <card name="4H"></card>
                                <card name="10C"></card>
                                <card name="3H" :is_flipped="true"></card>
                            </div>
                        </div>
                        <div class="deck seven-card-stud-hole">
                            <h6>4th Street</h6>
                            <div class="cards" >
                                <card name="4H"></card>
                                <card name="10C"></card>
                                <card name="3H" :is_flipped="true"></card>
                                <card name="JS" :is_flipped="true"></card>
                            </div>
                        </div>
                    </li>
                    <li>Second betting round.</li>
                    <li>Each player is dealt another card face-up (fifth street)</li>
                    <li>
                        <div class="deck seven-card-stud-hole">
                            <h6>HoleCards <span class="door">Door Card</span></h6>
                            <div class="cards" >
                                <card name="4H"></card>
                                <card name="10C"></card>
                                <card name="3H" :is_flipped="true"></card>
                            </div>
                        </div>
                        <div class="deck seven-card-stud-hole">
                            <h6>4th Street</h6>
                            <div class="cards">
                                <card name="4H"></card>
                                <card name="10C"></card>
                                <card name="3H" :is_flipped="true"></card>
                                <card name="JS" :is_flipped="true"></card>
                            </div>
                        </div>
                        <div class="deck seven-card-stud-hole">
                            <h6>HoleCards <span class="door">Door Card</span></h6>
                            <div class="cards" >
                                <card name="4H"></card>
                                <card name="10C"></card>
                                <card name="3H" :is_flipped="true"></card>
                            </div>
                        </div>
                        <div class="deck seven-card-stud-hole">
                            <h6>5th Street</h6>
                            <div class="cards" >
                                <card name="4H"></card>
                                <card name="10C"></card>
                                <card name="3H" :is_flipped="true"></card>
                                <card name="JS" :is_flipped="true"></card>
                                <card name="8C" :is_flipped="true"></card>
                            </div>
                        </div>
                    </li>
                    <li>Third betting round.</li>
                    <li>Each player is dealt another card face-up (sixth street)</li>
                    <li>
                        <div class="deck seven-card-stud-hole">
                            <h6>HoleCards <span class="door">Door Card</span></h6>
                            <div class="cards" >
                                <card name="4H"></card>
                                <card name="10C"></card>
                                <card name="3H" :is_flipped="true"></card>
                            </div>
                        </div>
                        <div class="deck seven-card-stud-hole">
                            <h6>6th Street</h6>
                            <div class="cards" >
                                <card name="4H"></card>
                                <card name="10C"></card>
                                <card name="3H" :is_flipped="true"></card>
                                <card name="JS" :is_flipped="true"></card>
                                <card name="8C" :is_flipped="true"></card>
                            </div>
                        </div>
                    </li>
                    <li>Fourth betting round.</li>
                    <li>Each player is dealt a final card face down (river)</li>
                    <li>
                        <div class="deck seven-card-stud-hole">
                            <h6>HoleCards <span class="door">Door Card</span></h6>
                            <div class="cards" >
                                <card name="4H"></card>
                                <card name="10C"></card>
                                <card name="3H" :is_flipped="true"></card>
                            </div>
                        </div>
                        <div class="deck seven-card-stud-hole">
                            <h6>River</h6>
                            <div class="cards">
                                <card name="4H"></card>
                                <card name="10C"></card>
                                <card name="3H" :is_flipped="true"></card>
                                <card name="JS" :is_flipped="true"></card>
                                <card name="8C" :is_flipped="true"></card>
                            </div>
                        </div>
                    </li>
                    <li>Last betting round.</li>
                    <li>Showdown (Every remaining player shows hand with first bettor or last raiser showing first).</li>
                </ul>
                <strong>Players can use any five of their seven cards to make their best hand.</strong>
            </div>
        </template>
        <template v-slot:rules>
            <div>
                <strong>Rules of Seven Card Stud</strong>
                <ul class="numbered">
                    <li>The first round of betting starts with a forced bet by the lowest upcard by suit. On subsequent betting rounds, the high hand on board initiates the action. (A tie is broken by position, with the player who received cards first acting first.)</li>
                    <li>The player with the forced bet has the option of opening for a full bet.</li>
                    <li>Increasing the amount wagered by the opening forced bet up to a full bet does not count as a raise, but merely as a completion of the bet. For example: In $15-$30 stud, the lowcard opens for $5. If the next player increases the bet to $15 (completes the bet), up to three raises are then allowed when using a three-raise limit.</li>
                    <li>In all fixed-limit games, when an open pair is showing on fourth street (second upcard), any player has the option of betting either the lower or the upper limit. For example: In a $5-$10 game, if you have a pair showing and are the high hand, you can bet either $5 or $10. If you bet $5, any player then has the option to call $5, raise $5, or raise $10. If a $10 raise is made, then all other raises must be in increments of $10. If the player high with the open pair on fourth street checks, then subsequent players have the same options that were given to the player who was high.</li>
                    <li>If your first or second holecard is accidentally turned up by the dealer, then your third card is dealt down. If both hole cards are dealt up, you have a dead hand and receive your ante back. If the first card dealt faceup would have been the lowcard, action starts with the first hand to that player's left. That player may fold, open for the forced bet, or open for a full bet. (In tournament play, if a downcard is dealt face up, a misdeal is called.)</li>
                    <li>If you are not present at the table when it is your turn to act on your hand, you forfeit your ante and your forced bet, if any. If you have not returned to the table in time to act, the hand is killed when the betting reaches your seat.</li>
                    <li>If a hand is folded even though there is no wager, that seat continues to receive cards until the hand is killed as a result of a bet.</li>
                    <li>If you are all in for the ante and have the lowcard, the player to your left acts first. That player can fold, open for the forced bet, or open for a full bet.</li>
                    <li>If the wrong person is designated as low and that person bets, the action is corrected to the true low card if the next player has not yet acted. The incorrect low card takes back the wager and the true low card must bet. If the next hand has acted after the incorrect low card wager, the wager stands, action continues from there, and the true low card has no obligations.</li>
                    <li>If you pick up your upcards without calling when facing a wager, this is a fold and your hand is dead. However, this act has no significance at the showdown because betting is over; the hand is live until discarded.</li>
                    <li>A card dealt off the table must play and it is treated as an exposed card.</li>
                    <li>In all games, the dealer announces the lowcard, the high hand, all raises, and all pairs. Dealers do not announce possible straights or flushes (except for specified low-stakes games).</li>
                    <li>If the dealer burns two cards for one round or fails to burn a card, the cards are corrected, if at all possible, to their proper positions. If this should happen on a final downcard, and either a card intermingles with a player's other holecards or a player looks at the card, the player must accept that card.</li>
                    <li>If the dealer burns and deals one or more cards before a round of betting has been completed, the cards must be eliminated from play. After the betting for that round is completed, an additional card for each remaining player still active in the hand is also eliminated from play (to later deal the same cards to the players who would have received them without the error). After that round of betting has concluded, the dealer burns a card and play resumes. The removed cards are held off to the side in the event the dealer runs out of cards. If the prematurely dealt card is the final downcard and has been looked at or intermingled with the player's other holecards, the player must keep the card, and on sixth street betting may not bet or raise (because the player now has all seven cards), but can call.</li>
                    <li>If there are not enough cards left in the deck for all players, all the cards are dealt except the last card, which is mixed with the burn cards (and any cards removed from the deck, as in the previous rule). The dealer then scrambles and cuts these cards, burns again, and delivers the remaining downcards, using the last card if necessary. If there are not as many cards as players remaining without a card, the dealer does not burn, so that each player can receive a fresh card. If the dealer determines that there will not be enough fresh cards for all of the remaining players, then the dealer announces to the table that a common card will be used. The dealer burns a card and turns one card face up in the center of the table as a common card that plays in everyone's hand. The player who is now high using the common card initiates the action for the last round.</li>
                    <li>An all-in player should receive hole cards dealt facedown, but if the final hole card to such a player is dealt face up, the card must be kept, and the other players receive their normal cards.</li>
                    <li>
                        If the dealer turns the last card faceup to any player, the hand now high on the board using all the upcards will start the action. The following rules apply to the dealing of cards:
                        <br>
                        <br>
                        If there are more than two players, all remaining players receive their last card facedown. A player whose last card is face up has the option of declaring all in (before betting action starts). If there are only two players remaining and the first player's final downcard is dealt faceup, the second player's final down card is also dealt face up, and the betting proceeds as normal. In the event the first player's final card is dealt face down and the opponent's final card is dealt face up, the player with the faceup final card has the option of declaring all in (before betting action starts).
                    </li>
                    <li>
                        A hand with more than seven cards is dead. A hand with fewer than seven cards at the showdown is dead, except any player missing a seventh card may have the hand ruled live.
                        <br>
                        <br>
                        <strong>
                            See
                            <a href="/rules-of-poker/explanations#4">Explanations, discussion #3</a>
                            , for more information on this rule.
                        </strong>
                        <br>
                    </li>
                    <li>A player who calls a bet even though beaten by an opponents upcards is not entitled to a refund. (The player is receiving information about an opponent's hand that is not available for free.)</li>
                </ul>
            </div>
        </template>
    </game-rules>
</template>

<script>
    import GameRules from "@/Pages/HowTo/GameRules";
    import Card from "@/components/Poker/Card";
    export default {
        name: "SevenCardStud",
        components:{
            GameRules,
            Card
        },
        data(){
            return{
                name: "SevenCardStud"
            }
        }
    }
</script>


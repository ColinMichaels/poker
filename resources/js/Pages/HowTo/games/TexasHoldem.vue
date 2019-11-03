<template>
    <game-rules :name="name">
        <template v-slot:heading>
            <div id="texas-holdem">
                <h2 class="text-4xl font-black">Texas Holdem:</h2>
                <p>In hold'em, players receive two down cards as their personal hand (holecards), after which there is a round of betting. Three board cards are turned simultaneously (called the flop) and another round of betting occurs. The next two board cards are turned one at a time, with a round of betting after each card. The board cards are community cards, and a player can use any five-card combination from among the board and personal cards. A player can even use all of the board cards and no personal cards to form a hand ("play the board"). A dealer button is used. The usual structure is to use two blinds, but it is possible to play the game with one blind, multiple blinds, an ante, or combination of blinds plus an ante.</p>
            </div>
        </template>
        <template v-slot:rounds>
            <div id="top">
               <h3 class="">Rounds of Betting:</h3>
                <ul class="order-1">
                    <li>
                        <strong>Opening deal</strong>
                        - Each player is dealt two cards face down, which are known as hole cards or pocket cards.
                    </li>
                    <li>
                        <div class="deck">
                            <h6>Pocket Cards</h6>
                            <div class="cards" >
                                <card name="AS"></card>
                                <card name="AC"></card>
                            </div>
                        </div>
                    </li>
                    <li>
                        <strong>First round of betting</strong>
                        - Starting with the player to the left of the big blind, each player can call the big blind, raise, or fold. The big blind has the option to raise an otherwise unraised pot.
                    </li>
                    <li id="flop">
                        <strong>The flop</strong>
                        - The dealer burns a card, and then deals three community cards face up. The first three cards are referred to as the flop, while all of the community cards are collectively called the board.
                        <div class="deck">
                            <h6>Flop</h6>
                            <div class="cards" >
                                <card name="4H"></card>
                                <card name="10C"></card>
                                <card name="7S"></card>
                            </div>
                        </div>
                    </li>
                    <li>
                        <strong>Second round of betting</strong>
                        - Starting with the player to the left of the dealer button, each player can check or bet. Once a bet has been made, each player can raise, call, or fold.
                    </li>
                    <li>
                        <strong>The turn</strong>
                        - The dealer burns another card, and then adds a fourth card face-up to the community cards. This fourth card is known as the turn card, or fourth street.
                        <div class="deck">
                            <h6>Flop</h6>
                            <div class="cards">
                                <card name="4H" :is_flipped="true"></card>
                                <card name="10C" :is_flipped="true"></card>
                                <card name="7S" :is_flipped="true"></card>
                                <span class="text-6xl font-black">+</span>
                                <card name="KS"></card>
                                <h6 class="top">Turn</h6>

                            </div>

                        </div>
                    </li>
                    <li>
                        <strong>Third round of betting</strong>
                        - It follows the same format as the second round, but the size of the bets have usually doubled in limit games.
                    </li>
                    <li>
                        <strong>The river</strong>
                        - The dealer burns another card, and then adds a fifth and final card to the community cards. This fifth card is known as the river card, or fifth street.
                        <div class="deck">
                            <h6>Flop</h6>
                            <div class="cards" >
                                <card name="4H" :is_flipped="true"></card>
                                <card name="10C" :is_flipped="true"></card>
                                <card name="7S" :is_flipped="true"></card>
                                <span class="text-6xl font-black">+</span>
                                <card name="KS" :is_flipped="true"></card>
                                <span class="text-6xl font-black">+</span>
                                <card name="AS" :is_flipped="true"></card>
                                <h6 class="top">River</h6>
                            </div>
                        </div>
                    </li>
                   <li>
                        <div class="deck texas-holdem-street">
                            <h6>The Turn</h6>
                            <div class="cards">
                             <card name="KS" :is_flipped="true"></card>
                            </div>
                        </div>
                        <div class="deck texas-holdem-street">
                            <h6>The River</h6>
                            <div class="cards" >
                            <card name="AS" :is_flipped="true"></card>
                            </div>
                        </div>
                   </li>
                    <li>
                        <strong>Final round of betting</strong>
                        - It follows the same format as the second and third rounds.
                    </li>
                    <li>
                        <div class="deck">
                            <div class="cards" >
                                <card name="4H" :is_flipped="true"></card>
                                <card name="10C" :is_flipped="true"></card>
                                <card name="7S" :is_flipped="true"></card>
                                <span class="text-6xl font-black">+</span>
                                <card name="KS" :is_flipped="true"></card>
                                <span class="text-6xl font-black">+</span>
                                <card name="AS" :is_flipped="true"></card>
                            </div>
                        </div
                    </li>
                    <li>
                        <strong>The showdown</strong>
                        - Using the best five-card combination of their hole cards and the community cards, the remaining players show their hands, with the bettor or last raiser showing first. The highest five-card hand wins the pot. (In case of a tie, the pot is evenly split among the winning hands.)
                    </li>
                </ul>
            </div>
        </template>

        <template v-slot:rules>
            <div>
                <h3>Other Rules:</h3>
                <ul class="numbered">
                    <li>
                    <strong>
                        These rules deal only with irregularities. See
                        <a href="/rules-of-poker/buttons-and-blinds">Button and Blind</a>
                        use for rules on that subject.
                    </strong>
                    </li>
                    <li>If the first or second hole card dealt is exposed, a misdeal results. The dealer retrieves the card, reshuffles, and recuts the cards. If any other holecard is exposed due to a dealer error, the deal continues. The exposed card can not be kept. After completing the hand, the dealer replaces the card with the top card on the deck, and the exposed card is then used for the burncard. If more than one hole card is exposed, this is a misdeal and there must be a redeal.</li>
                    <li>If the flop contains too many cards, it must be redealt. (This applies even if it is possible to know which card is the extra one.)</li>
                    <li>
                        If the flop needs to be redealt because the cards were prematurely flopped before the betting was complete, or the flop contained too many cards, the board cards are mixed with the remainder of the deck. The burn card remains on the table. After shuffling, the dealer cuts the deck and deals a new flop without burning a card.
                        <br>
                        <br>
                        <strong>
                            See Explanations,
                            <a href="/rules-of-poker/explanations#2">discussion #2</a>
                            , for more information on this rule.
                        </strong>
                        <br>
                        <br>
                    </li>
                    <li>
                        If the dealer turns the fourth card on the board before the betting round is complete, the card is taken out of play for that round, even if subsequent players elect to fold. The betting is then completed. The dealer burns and turns what would have been the fifth card in the fourth card's place. After this round of betting, the dealer reshuffles the deck, including the card that was taken out of play, but not including the burn cards or discards. The dealer then cuts the deck and turns the final card without burning a card. If the fifth card is turned up prematurely, the deck is reshuffled and dealt in the same manner.
                        <br>
                        <br>
                        <strong>
                            See Explanations,
                            <a href="/rules-of-poker/explanations#2">discussion #2</a>
                            , for more information on this rule.
                        </strong>
                        <br>
                        <br>
                    </li>
                    <li>If the dealer mistakenly deals the first player an extra card (after all players have received their starting hands), the card is returned to the deck and used for the burn card. If the dealer mistakenly deals more than one extra card, it is a misdeal.</li>
                    <li>If you are playing the board, you must so declare before you throw your cards away; otherwise you relinquish all claim to the pot.</li>
                </ul>
            </div>
        </template>
    </game-rules>
</template>

<script>
    import GameRules from "@/Pages/HowTo/GameRules";
    import Card from "@/components/Poker/Card";

    export default {
        name: "TexasHoldem",
        components:{
            GameRules,
            Card,
        },
        data(){
            return{
                name: "TexasHoldem"
            }
        }
    }
</script>

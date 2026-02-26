<template>
    <game-rules :name="name">
        <template v-slot:heading>
            <div>
                <h2 class="text-4xl font-black">Lowball:</h2>
                <p>Lowball is draw poker with the lowest hand winning the pot. Each player is dealt five cards face down, after which there is a betting round. Players are required to open with a bet or fold. The players who remain in the pot after the first betting round now have an option to improve their hands by replacing cards in their hands with new ones. This is the draw. The game is normally played with one or more blinds, sometimes with an ante added. Some betting structures allow the big blind to be called; other structures require the minimum open to be double the big blind. In limit poker, the usual structure has the limit double after the draw (Northern California is an exception.) The most popular forms of lowball are ace-to-five lowball (also known as California lowball), and deuce-to-seven lowball (also known as Kansas City lowball). Ace-to-five lowball gets its name because the best hand at that form is 5-4-3-2-A. Deuce-to-seven lowball gets its name because the best hand at that form is 7-5-4-3-2 (not of the same suit). For a further description of the forms of lowball, see the individual section for each game. All rules governing kill pots are listed in Kill Pots.</p>
            </div>
        </template>
        <template v-slot:rounds>
            <div>

            </div>
        </template>
        <template v-slot:rules>
            <div>
                <strong>Rules of Lowball</strong>
                <strong>Rules of Lowball</strong>
                <br>
                <br>
                <ul class="numbered">
                    <li>
                        The rules governing misdeals for hold'em and other button games are used for lowball.
                        <br>
                        <br>
                        <strong>
                            See Explanations,
                            <a href="/rules-of-poker/explanations#7">discussion #7</a>
                            , for more information on this rule.
                        </strong>
                    </li>
                    <li>These rules governing misdeals are reprinted here for convenience. "The following circumstances cause a misdeal, provided attention is called to the error before two players have acted on their hands:</li>
                    <ul style="list-style:lower-alpha; margin-left: 20px">
                        <li>The first or second card of the hand has been dealt faceup or exposed through dealer error.</li>
                        <li>Two or more cards have been exposed by the dealer.</li>
                        <li>Two or more extra cards have been dealt in the starting hands of a game.</li>
                        <li>An incorrect number of cards has been dealt to a player, except the button can receive one more card to complete a starting hand.</li>
                        <li>The button was out of position.</li>
                        <li>The first card was dealt to the wrong position.</li>
                        <li>Cards have been dealt out of the proper sequence.</li>
                        <li>Cards have been dealt to an empty seat or a player not entitled to a hand.</li>
                        <li>A player has been dealt out who is entitled to a hand. This player must be present at the table or have posted a blind or ante."</li>
                    </ul>
                    <li>
                        In limit play, a bet and four raises are allowed in multihanded pots.
                        <br>
                        <br>
                        <strong>
                            See Explanations,
                            <a href="/rules-of-poker/explanations#6">discussion #6</a>
                            , for more information on this rule.
                        </strong>
                    </li>
                    <li>A new player, has two options:</li>
                    <ul style="list-style:lower-alpha; margin-left: 20px">
                        <li>Wait for the big blind.</li>
                        <li>Kill the pot for double the amount of the big blind.</li>
                    </ul>
                    <li>In a single-blind game, a player who has less than half a blind can receive a hand. However, the next player is obligated to take the blind. If the all-in player wins the pot or buys in again, that player is then obligated either to take the blind on the next deal or sit out until due for the big blind.</li>
                    <li>In single-blind games, half a blind or more constitutes a full blind.</li>
                    <li>In single-blind games, if a player fails to take the blind, the player can be dealt in only on the blind.</li>
                    <li>In multiple-blind games, if for any reason the big blind passes a player's seat, the player can either wait for the big blind or kill the pot in order to receive a hand. This does not apply if the player has taken all of his blinds and changed seats. In this situation, the player can be dealt in as soon as his position relative to the blinds entitles him to a hand (the button may go by him once without penalty).</li>
                    <li>Before the draw, whether an exposed card must be taken depends on the form of lowball being played; see that form. (The player never has an option.)</li>
                    <li>On the draw, an exposed card cannot be taken. The draw is completed to each player in order, and then the exposed card is replaced.</li>
                    <li>
                        A player can draw up to four consecutive cards. If a player wishes to draw five new cards, four are dealt right away, and the fifth card after everyone else has drawn cards. If the last player wishes to draw five new cards, four are dealt right away, and a card is burned before the player receives a fifth card.
                        <br>
                        <br>
                        <strong>
                            See Explanations,
                            <a href="/rules-of-poker/explanations#9">discussion #9</a>
                            , for more information on this rule.
                        </strong>
                    </li>
                    <li>Five cards constitutes a playing hand; more or fewer than five cards after the draw constitutes a fouled hand. Before the draw, if a player has fewer than five cards in his hand, he can receive additional cards, provided no action has been taken by the first player to act (unless that action occurs before the deal is completed). However, the dealer position can still receive a missing fifth card, even if action has taken place. If action has been taken, a player with fewer than five cards is entitled on the draw to receive the number of cards necessary to complete a five-card hand.</li>
                    <li>A player can change the number of cards he wishes to draw, provided:</li>
                    <ul style="list-style:lower-alpha; margin-left: 20px">
                        <li>No card has been dealt off the deck in response to his request (including the burncard).</li>
                        <li>No player has acted, in either the betting or indicating the number of cards to be drawn, based on the number of cards the player has requested.</li>
                    </ul>
                    <li>If a player is asked by another active player how many cards he drew the player is obligated to respond until there has been action after the draw, and the dealer is also obligated to respond. Once there is any action after the draw, the player is no longer obliged to respond and the dealer must not respond.</li>
                    <li>Rapping the table in turn constitutes either a pass or the declaration of a pat hand that does not want to draw any cards, depending on the situation.</li>
                    <li>Cards speak (cards read for themselves). However, a player is not allowed to claim a better hand than he holds. (Example: If a player declares "8", that player must produce at least an 8 low or better to win. But if a player erroneously calls the second card incorrectly, such as "8-6" when actually holding an 8-7, no penalty applies.) If a player miscalls his hand and causes another player to foul his hand, the hand of the player who misdeclared is dead. If both hands remain intact, the best hand wins. If a miscalled hand occurs in a multihanded pot, the miscalled hand is dead, and the best remaining hand wins the pot. For your own protection, always hold your hand until you see your opponent's cards.</li>
                    <li>Any player spreading a hand with a pair in it must announce "pair" or risk losing the pot if it causes any other player to foul a hand. If two or more hands remain intact, the best hand wins the pot.</li>
                </ul>
                <strong>Ace-to-Five Lowball</strong>
                <br>
                <br>
                In ace-to-five lowball, the best hand is any 5-4-3-2-A. Straights and flushes do not count against a hand.
                <br>
                <ul class="numbered">
                    <li>If a joker is used, it becomes the lowest card not present in the hand. The joker is assumed to be in use unless the contrary is posted.</li>
                    <li>In limit play, check-raise is not permitted (unless the players are alerted that it is allowed).</li>
                    <li>
                        In limit ace-to-five lowball, before the draw, an exposed card of 7 or under must be taken, and an exposed card higher than a 7 must be replaced after the deal has been completed. This first exposed card is used as the burn card.
                        <br>
                        <br>
                        <strong>
                            See Explanations,
                            <a href="/rules-of-poker/explanations#8">discussion #8</a>
                            , for more information on this rule.
                        </strong>
                    </li>
                    <li>In limit play, the sevens rule is assumed to be in use (the players should be alerted if it is not). If a player checks a 7 or better and it is the best hand, all action after the draw is void, and the player cannot win any money on any subsequent bets. The player is still eligible to win whatever existed in the pot before the draw if he has the best hand. If a player checks a 7 or better and the hand is beaten, he loses the pot and any additional calls he makes. If there is an all-in bet after the draw that is less than half a bet, a 7 or better can just call and win that bet. However, if another player overcalls this short bet and loses, the person who overcalls receives the bet back. If the seven or better completes to a full bet, this fulfills all obligations.</li>
                </ul>
                <strong>Deuce-to-Seven Lowball</strong>
                <br>
                <br>
                In deuce-to-seven lowball (sometimes known as Kansas City lowball), in most respects, the worst conventional poker hand wins. Straights and flushes count against a player, crippling the value of a hand. The ace is used only as a high card. Therefore, the best hand is 7-5-4-3-2, not all of the same suit. The hand 5-4-3-2-A is not considered to be a straight, but an A-5 high, so it beats other ace-high hands and pairs, but loses to king-high. A pair of aces is the highest pair, so it loses to any other pair. The rules for deuce-to-seven lowball are the same as those for ace-to-five lowball, except for the following differences:
                <br>
                <br>
                <ul class="numbered">
                    <li>The best hand is 7-5-4-3-2 of at least two different suits. Straights and flushes count against a player, and aces are considered high only.</li>
                    <li>Before the draw, an exposed card of 7, 5, 4, 3, or, 2 must be taken. Any other exposed card must be replaced (including a 6).</li>
                    <li>Check-raise is allowed on any hand after the draw, and a 7 or better is not required to bet.</li>
                </ul>
                <strong>No-Limit and Pot-Limit Lowball</strong>
                <br>
                <br>
                <ul class="numbered">
                    <li>All the rules for no-limit and pot-limit poker apply to no-limit and pot-limit lowball. All other lowball rules apply, except as noted.</li>
                    <li>A player is not entitled to know that an opponent cannot hold the best possible hand, so these rules for exposed cards before the draw apply:</li>
                    <ul style="list-style:lower-alpha; margin-left: 20px">
                        <li>In ace-to-five lowball, a player must take an exposed card of A, 2, 3, 4, or 5, and any other card must be replaced.</li>
                        <li>In deuce-to-seven lowball, the player must take an exposed card of 2, 3, 4, 5, or 7, and any other card including a 6 must be replaced.</li>
                    </ul>
                    <li>After the draw, any exposed card must be replaced.</li>
                    <li>After the draw, a player can check any hand without penalty (The sevens rule is not used).</li>
                    <li>Check-raise is allowed.</li>
                </ul>
            </div>
        </template>
    </game-rules>
</template>

<script>
    import GameRules from "@/Pages/HowTo/GameRules";
    import Card from "@/components/Poker/Card";
    export default {
        name: "Lowball",
        components:{
            GameRules
        },
        data(){
            return{
                name : "Lowball"
            }
        }
    }
</script>

<template>
    <game-rules :name="name">
        <template v-slot:heading>
            <div>
                <h2 class="text-4xl font-black">DrawHigh:</h2>
                <p>There are two betting rounds, one before the draw and one after the draw. The game is played with a button and an ante. Players in turn can check, open for the minimum, or open with a raise. After the first betting round, players have the opportunity to draw new cards to replace the ones they discard. Action after the draw starts with the opener, or next player proceeding clockwise if the opener has folded. The betting limit after the draw is twice the amount of the betting limit before the draw. Some draw high games allow a player to open with any holding; others require the opener to have a pair of jacks or better.</p>
            </div>
        </template>
        <template v-slot:rounds>
            <div>

            </div>
        </template>
        <template v-slot:rules>
            <div>
                <strong>Rules of DrawHigh</strong>
                <ul class="numbered">
                    <li>
                        A maximum of one bet and four raises is permitted in multihanded pots.
                        <br>
                        <br>
                        <strong>
                            See Explanations,
                            <a href="/rules-of-poker/explanations#6">discussion #6</a>
                            , for more information on this rule.
                        </strong>
                    </li>
                    <li>Check-raise is permitted both before and after the draw.</li>
                    <li>Any card that is exposed by the dealer before the draw must be kept.</li>
                    <li>Five cards constitute a playing hand. Fewer than five cards for a player (other than the button) before action has been taken is a misdeal. If action has been taken, a player with fewer than five cards may draw the number of cards necessary to complete a five-card hand. The button can receive the fifth card even if action has taken place. More or fewer than five cards after the draw constitutes a fouled hand.</li>
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
                    <li>You can change the number of cards you wish to draw, provided:</li>
                    <ul style="list-style:lower-alpha; margin-left: 20px">
                        <li>No cards have been dealt off the deck in response to your request (including the burncard).</li>
                        <li>No player has acted, in either the betting or indicating the number of cards to be drawn, based on the number of cards you have requested.</li>
                    </ul>
                    <li>If you are asked how many cards you drew by another active player, you are obligated to respond until there has been action after the draw, and the dealer is also obligated to respond. Once there is any action after the draw, you are no longer obliged to respond and the dealer cannot respond.</li>
                    <li>On the draw, an exposed card cannot be taken. The draw is completed to each player in order, and then the exposed card is replaced.</li>
                    <li>Rapping the table in turn constitutes either a pass or the declaration of a pat hand that does not want to draw any cards, depending on the situation. A player who indicates a pat hand by rapping the table, not knowing the pot has been raised, can still play the hand.</li>
                    <li>You can not change your seat between hands when there are multiple antes or forfeited money in the pot.</li>
                    <li>You have the right to pay the ante (whether single or multiple) at any time and receive a hand, unless there is any additional money in the pot that has been forfeited during a hand in which you were not involved.</li>
                    <li>If the pot has been declared open by an all-in player playing for just the antes, all callers must come in for the full opening bet.</li>
                    <li>If you have only a full ante and no other chips on the table, you can play for just the antes. If no one opens and there is another ante, you can still play for that part of the antes that you have matched, without putting in any more money.</li>
                </ul>
            </div>
        </template>
    </game-rules>
</template>

<script>
    import GameRules from "@/Pages/HowTo/GameRules";
    import Card from "@/components/Poker/Card";
    export default {
        name: "DrawHigh",
        components:{
            GameRules,
            Card
        },
        data(){
            return{
                name : "DrawHigh"
            }
        }
    }
</script>

<template>
    <game-rules :name="name">
        <template v-slot:heading>
            <div>
                <h2 class="text-4xl font-black">Seven-Card Stud High-Low:</h2>
                 <p>Seven-card stud high-low split is a stud game that is played both high and low. A qualifier of 8-or-better for low applies to all high-low split games, unless a specific posting to the contrary is displayed. The low card initiates the action on the first round, with an ace counting as a high card for this purpose. On subsequent rounds, the high hand initiates the action. If the high hand is tied, the first player clockwise from the dealer acts first. Fixed-limit games use the lower limit on third and fourth street and the upper limit on subsequent betting rounds, and an open pair does not affect the limit. Aces can be used for high or low. Straights and flushes do not affect the low value of a hand. A player can use any five cards to make the best high hand, and the same or any other grouping of five cards to make the best low hand.</p>
            </div>
        </template>
        <template v-slot:rounds>
            <div>
                <div class="deck">
                    <div class="cards" >
                        <card name="4H"></card>
                        <card name="10C"></card>
                        <card name="7S"></card>
                        <card name="8S"></card>
                        <card name="9S"></card>
                        <card name="10S"></card>
                        <card name="JS"></card>
                        <card name="QS"></card>
                    </div>
                </div>
            </div>
        </template>
        <template v-slot:rules>
            <div>
                <strong>Rules of Seven-Card Stud High-Low</strong>
                <ul>
                <li>All rules for seven-card stud apply to seven-card stud high-low split, except as otherwise noted.</li>
                <li>A qualifier of 8-or-better for low applies to all high-low split games, unless a specific posting to the contrary is displayed. If there is no qualifying hand for low, the best high hand wins the whole pot.</li>
                <li>A player can use any five cards to make the best high hand and any five cards, whether the same as the high hand or not, to make the best low hand.</li>
                <li>The low card by suit (clubs, diamonds, hearts, spades) initiates the action on the first round, with an ace counting as a high card for this purpose.</li>
                <li>An ace can be used for high or low.</li>
                <li>Straights and flushes do not affect the value of a low hand.</li>
                <li>Fixed-limit games use the lower limit on third and fourth streets and the upper limit on subsequent rounds. An open pair on fourth street does not affect the limit.</li>
                <li>Splitting pots is determined only by the cards and not by agreement among players.</li>
                <li>When there is an odd chip in a pot, the chip goes to the high hand. If two players split the pot by tying for both the high and the low, the pot shall be split as evenly as possible, and the player with the highest card by suit receives the odd chip. When making this determination, all cards are used, not just the five cards used for the final hand played.</li>
                <li>When there is one odd chip in the high portion of the pot and two or more high hands split all or half the pot, the odd chip goes to the player with the high card by suit. When two or more low hands split half the pot, the odd chip goes to the player with the low card by suit.</li>
                </ul>
            </div>
        </template>
    </game-rules>
</template>

<script>
    import GameRules from "@/Pages/HowTo/GameRules";
    import Card from "@/components/Poker/Card";
    export default {
        name: "SevenCardStudHighLow",
        components:{
            GameRules,
            Card
        },
        data(){
            return{
                name : "SevenCardStudHighLow"
            }
        }
    }
</script>

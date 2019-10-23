<?php

namespace spec\Poker;

use Poker\EvaluateHand;
use PhpSpec\ObjectBehavior;
use Prophecy\Argument;

class EvaluateHandSpec extends ObjectBehavior
{
    function it_is_initializable()
    {
        $this->shouldHaveType(EvaluateHand::class);
    }
}

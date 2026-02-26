<?php

namespace spec\Poker;

use Poker\Suit;
use PhpSpec\ObjectBehavior;
use Prophecy\Argument;

class SuitSpec extends ObjectBehavior
{
    function it_is_initializable()
    {
        $this->shouldHaveType(Suit::class);
    }
}

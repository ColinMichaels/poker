<?php

namespace spec\Poker;

use Poker\Chip;
use PhpSpec\ObjectBehavior;
use Prophecy\Argument;

class ChipSpec extends ObjectBehavior
{
    function it_is_initializable()
    {
        $this->shouldHaveType(Chip::class);
    }

}

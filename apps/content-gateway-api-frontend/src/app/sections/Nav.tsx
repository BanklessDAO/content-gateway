import { MoonIcon, SunIcon } from "@chakra-ui/icons";
import {
    Box,
    Button,
    Flex,
    Link,
    Menu,
    MenuItem,
    MenuList,
    Stack,
    useColorMode,
    useColorModeValue,
} from "@chakra-ui/react";
import { HStack } from "@chakra-ui/layout";
import { FunctionComponent } from "react";
import { Link as RouterLink } from "react-router-dom";

type Props = {
    children: React.ReactNode;
};

type PropsWithLink = {
    link: string;
    children: React.ReactNode;
};

const NavLink: FunctionComponent<PropsWithLink> = ({ link, children }) => (
    <Link
        px={2}
        py={1}
        rounded={"md"}
        _hover={{
            textDecoration: "none",
            bg: useColorModeValue("gray.200", "gray.700"),
        }}
        as={RouterLink}
        to={link}
    >
        {children}
    </Link>
);

const Links = [
    ["Home", "/"],
    ["Schemas", "/schemas"],
];

const Nav: FunctionComponent = () => {
    const { colorMode, toggleColorMode } = useColorMode();
    return (
        <Box bg={useColorModeValue("gray.100", "gray.900")} px={4}>
            <Flex h={16} alignItems={"center"} justifyContent={"space-between"}>
                <HStack spacing={4} as={"nav"} alignItems={"center"}>
                    {Links.map(([label, link]) => (
                        <NavLink key={link} link={link}>
                            {label}
                        </NavLink>
                    ))}
                </HStack>
                <Flex alignItems={"center"}>
                    <Stack direction={"row"} spacing={7}>
                        <Button onClick={toggleColorMode}>
                            {colorMode === "light" ? <MoonIcon /> : <SunIcon />}
                        </Button>
                    </Stack>
                </Flex>
            </Flex>
        </Box>
    );
};

export default Nav;

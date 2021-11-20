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
import { FunctionComponent } from "react";

type Props = {
    children: JSX.Element;
};

const NavLink: FunctionComponent<Props> = ({ children }) => (
    <Link
        px={2}
        py={1}
        rounded={"md"}
        _hover={{
            textDecoration: "none",
            bg: useColorModeValue("gray.200", "gray.700"),
        }}
        href={"#"}
    >
        {children}
    </Link>
);

const Nav: FunctionComponent = () => {
    const { colorMode, toggleColorMode } = useColorMode();
    return (
        <Box bg={useColorModeValue("gray.100", "gray.900")} px={4}>
            <Flex h={16} alignItems={"center"} justifyContent={"space-between"}>
                <Box>Logo</Box>

                <Flex alignItems={"center"}>
                    <Stack direction={"row"} spacing={7}>
                        <Button onClick={toggleColorMode}>
                            {colorMode === "light" ? <MoonIcon /> : <SunIcon />}
                        </Button>

                        <Menu>
                            <MenuList alignItems={"center"}>
                                <br />
                                <MenuItem>Schemas</MenuItem>
                            </MenuList>
                        </Menu>
                    </Stack>
                </Flex>
            </Flex>
        </Box>
    );
};

export default Nav;
